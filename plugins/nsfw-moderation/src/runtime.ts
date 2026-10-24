import {
  PluginError,
  withAbortSignal,
  type Config,
  type FileInput,
  type InstanceServices,
  type PostSavePlugin,
} from "@picloom/plugin-sdk";
import {
  WorkerClassifier,
  classes,
  type Classifier,
  type ClassName,
  type Scores,
} from "./classifier";

export interface Settings {
  categories: ClassName[];
  threshold: number;
  blockAction: "block" | "delete";
  maxFrames: number;
  maxContentMiB: number;
  timeoutMs: number;
}

export function frameIndices(total: number, maximum: number): number[] {
  const count = Math.min(total, maximum);
  return count === 1
    ? [0]
    : Array.from({ length: count }, (_, i) =>
        Math.round((i * (total - 1)) / (count - 1)),
      );
}

async function readContent(
  file: FileInput,
  limit: number,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const tooLarge = () =>
    new PluginError(
      "RESOURCE_LIMIT",
      "Image exceeds the configured content size limit",
    );
  if (file.metadata.byteSize !== null && file.metadata.byteSize > limit)
    throw tooLarge();
  const reader = (await file.openRead()).getReader();
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw tooLarge();
      chunks.push(value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Cancellable FIFO; queued files hold neither image bytes nor a worker. */
class Gate {
  private busy = false;
  private waiters: Array<() => void> = [];

  acquire(signal: AbortSignal): Promise<() => void> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const enter = () => {
        signal.removeEventListener("abort", abort);
        this.busy = true;
        resolve(() => {
          const next = this.waiters.shift();
          if (next) next();
          else this.busy = false;
        });
      };
      const abort = () => {
        const index = this.waiters.indexOf(enter);
        if (index !== -1) this.waiters.splice(index, 1);
        reject(signal.reason);
      };
      if (!this.busy) enter();
      else {
        this.waiters.push(enter);
        signal.addEventListener("abort", abort, { once: true });
      }
    });
  }
}

export function createRuntime(
  config: Settings,
  services: InstanceServices,
  classifier: Classifier = new WorkerClassifier(),
): PostSavePlugin {
  const gate = new Gate();
  const lifetime = new AbortController();
  let active: Promise<void> = Promise.resolve();
  const sharp = services.images.sharp;
  return {
    async execute(input, ctx) {
      const cancellation = AbortSignal.any([ctx.signal, lifetime.signal]);
      const release = await gate.acquire(cancellation);
      const idle = Promise.withResolvers<void>();
      active = idle.promise;
      const deadline = new AbortController();
      const timer = setTimeout(() => deadline.abort(), config.timeoutMs);
      const signal = AbortSignal.any([cancellation, deadline.signal]);
      try {
        const bytes = await readContent(
          input.file,
          config.maxContentMiB * 1024 ** 2,
          signal,
        );
        // Read metadata and each selected frame separately, with a per-frame pixel budget.
        const decode = async <T>(operation: () => Promise<T>): Promise<T> => {
          try {
            return await operation();
          } catch {
            signal.throwIfAborted();
            throw new PluginError(
              "INVALID_DATA",
              "Image cannot be decoded within the NSFW pixel limit",
            );
          }
        };
        const metadata = await decode(() => {
          const image = sharp(bytes, {
            limitInputPixels: 40_000_000,
            pages: 1,
          });
          return withAbortSignal(image, signal, () => image.metadata());
        });
        if (
          !metadata.format ||
          ![
            "jpeg",
            "png",
            "gif",
            "webp",
            "heif",
            "avif",
            "tiff",
            "svg",
          ].includes(metadata.format)
        )
          throw new PluginError(
            "UNSUPPORTED",
            "Unsupported image format for NSFW moderation",
          );
        const totalFrames =
          metadata.format === "svg" ? 1 : (metadata.pages ?? 1);
        const indices = frameIndices(totalFrames, config.maxFrames);
        const scores = Object.fromEntries(
          classes.map((name) => [name, 0]),
        ) as Scores;
        for (const page of indices) {
          signal.throwIfAborted();
          const pixels = await decode(() => {
            const image = sharp(bytes, {
              page,
              pages: 1,
              limitInputPixels: 40_000_000,
            })
              .rotate()
              .toColourspace("srgb")
              .flatten({ background: "#ffffff" })
              .resize(224, 224, { fit: "fill" })
              .removeAlpha()
              .raw();
            return withAbortSignal(image, signal, () => image.toBuffer());
          });
          const frame = await classifier.classify(pixels, signal);
          signal.throwIfAborted();
          for (const name of classes)
            scores[name] = Math.max(scores[name], frame[name]);
        }
        const matchedCategories = config.categories.filter(
          (name) => scores[name] >= config.threshold,
        );
        const details: Config = {
          model: "NSFWJS/MobileNetV2",
          categories: config.categories,
          threshold: config.threshold,
          scores,
          matchedCategories,
          totalFrames,
          sampledFrames: indices.length,
        };
        return {
          disposition: {
            value: matchedCategories.length ? config.blockAction : "pass",
          },
          details,
        };
      } catch (error) {
        if (signal.aborted) classifier.dispose();
        cancellation.throwIfAborted();
        if (deadline.signal.aborted)
          throw new PluginError("FAILED", "NSFW moderation timed out");
        throw error;
      } finally {
        clearTimeout(timer);
        idle.resolve();
        release();
      }
    },
    async dispose() {
      lifetime.abort();
      classifier.dispose();
      await active;
    },
  };
}
