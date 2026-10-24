import { PluginError } from "@picloom/plugin-sdk";
import workerSource from "../.generated/worker";

export const classes = [
  "Drawing",
  "Hentai",
  "Neutral",
  "Porn",
  "Sexy",
] as const;
export type ClassName = (typeof classes)[number];
export type Scores = Record<ClassName, number>;
export interface Classifier {
  classify(pixels: Uint8Array, signal: AbortSignal): Promise<Scores>;
  dispose(): void;
}

export function readScores(value: unknown): Scores {
  const invalid = () =>
    new PluginError("INVALID_DATA", "Invalid NSFW model output");
  if (!Array.isArray(value) || value.length !== classes.length) throw invalid();
  const result = {} as Scores;
  for (const item of value) {
    if (
      !item ||
      !classes.includes(item.className) ||
      item.className in result ||
      typeof item.probability !== "number" ||
      !Number.isFinite(item.probability) ||
      item.probability < 0 ||
      item.probability > 1
    )
      throw invalid();
    result[item.className as ClassName] = item.probability;
  }
  return result;
}

/** One request at a time; the runtime owns serialization across whole files. */
export class WorkerClassifier implements Classifier {
  private worker?: Worker;
  private url?: string;
  private ready = false;
  private rejectPending?: (error: unknown) => void;

  constructor(private readonly source = workerSource) {}

  private stop() {
    const worker = this.worker;
    this.worker = undefined;
    this.ready = false;
    worker?.terminate();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = undefined;
  }

  private exchange(signal: AbortSignal, pixels?: Uint8Array): Promise<unknown> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const finish = (error?: unknown, value?: unknown) => {
        if (this.rejectPending !== fail) return;
        this.rejectPending = undefined;
        signal.removeEventListener("abort", abort);
        if (error !== undefined) {
          this.stop();
          reject(error);
        } else resolve(value);
      };
      const fail = (error: unknown) => finish(error);
      const abort = () => fail(signal.reason);
      this.rejectPending = fail;
      signal.addEventListener("abort", abort, { once: true });
      try {
        if (!this.worker) {
          this.url = URL.createObjectURL(
            new Blob([this.source], { type: "application/javascript" }),
          );
          this.worker = new Worker(this.url);
          this.worker.onerror = () => {
            if (this.worker !== worker) return;
            const error = new PluginError(
              "FAILED",
              "NSFW worker exited unexpectedly",
              true,
            );
            if (this.rejectPending) this.rejectPending(error);
            else this.stop();
          };
          this.worker.addEventListener("close", () => {
            // A previous, explicitly terminated worker must not stop its successor.
            if (this.worker !== worker) return;
            const error = new PluginError(
              "FAILED",
              "NSFW worker exited unexpectedly",
              true,
            );
            if (this.rejectPending) this.rejectPending(error);
            else this.stop();
          });
        }
        const worker = this.worker;
        worker.onmessage = ({ data }) => {
          if (data?.type === "error") {
            fail(
              new PluginError(
                "FAILED",
                data.phase === "load"
                  ? "NSFW model could not be loaded"
                  : "NSFW inference failed",
              ),
            );
          } else if (pixels === undefined && data?.type === "ready") {
            this.ready = true;
            finish(undefined);
          } else if (pixels !== undefined && data?.type === "result") {
            finish(undefined, data.predictions);
          } else
            fail(
              new PluginError("INVALID_DATA", "Invalid NSFW worker response"),
            );
        };
        if (pixels !== undefined) worker.postMessage(pixels);
      } catch {
        fail(new PluginError("FAILED", "NSFW worker could not be started"));
      }
    });
  }

  async classify(pixels: Uint8Array, signal: AbortSignal) {
    if (!this.ready) await this.exchange(signal);
    const result = await this.exchange(signal, pixels);
    try {
      return readScores(result);
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  dispose() {
    this.rejectPending?.(
      new PluginError("FAILED", "NSFW instance was disposed"),
    );
    this.stop();
  }
}
