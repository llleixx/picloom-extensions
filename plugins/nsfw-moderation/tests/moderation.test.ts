import { expect, test } from "bun:test";
import { PluginError, type FileInput } from "@picloom/plugin-sdk";
import { image, services } from "../../../tests/services";
import definition from "../src";
import { createRuntime, frameIndices } from "../src/runtime";
import type { Classifier } from "../src/classifier";
import { context, file, input, safeScores, settings } from "./helpers";

test("category thresholds, optional Sexy and cumulative dispositions", async () => {
  const source = input(file(await image()));
  let scores = safeScores();
  const classifier: Classifier = {
    async classify() {
      return scores;
    },
    dispose() {},
  };
  const runtime = createRuntime(settings, services({}), classifier);
  scores = { Drawing: 0, Hentai: 0.4, Neutral: 0, Porn: 0.6, Sexy: 0 };
  expect((await runtime.execute(source, context())).disposition).toEqual({
    value: "pass",
  });
  scores = { Drawing: 0, Hentai: 0, Neutral: 0.2, Porn: 0.8, Sexy: 0 };
  expect((await runtime.execute(source, context())).disposition).toEqual({
    value: "block",
  });
  scores = { Drawing: 0, Hentai: 0.8, Neutral: 0.2, Porn: 0, Sexy: 0 };
  const deletion = createRuntime(
    { ...settings, blockAction: "delete" },
    services({}),
    classifier,
  );
  expect((await deletion.execute(source, context())).disposition).toEqual({
    value: "delete",
  });
  scores = { Drawing: 0, Hentai: 0, Neutral: 0, Porn: 0, Sexy: 1 };
  expect((await runtime.execute(source, context())).disposition).toEqual({
    value: "pass",
  });
  const sexy = createRuntime(
    { ...settings, categories: ["Sexy"] },
    services({}),
    classifier,
  );
  expect((await sexy.execute(source, context())).disposition).toEqual({
    value: "block",
  });
  // Existing decisions are accumulated by the host, never replaced.
  expect(
    (
      await runtime.execute(
        { ...source, currentDisposition: "delete" },
        context(),
      )
    ).disposition,
  ).toEqual({ value: "pass" });
  await runtime.dispose?.();
  await deletion.dispose?.();
  await sexy.dispose?.();
});

test("GIF and animated WebP sample non-first frames and aggregate category maxima", async () => {
  const sharp = services({}).images.sharp;
  for (const format of ["gif", "webp"] as const) {
    const frames = Buffer.concat(
      Array.from({ length: 21 }, (_, index) =>
        Buffer.from(
          Array.from({ length: 16 * 16 }, () => [index * 10, 0, 0]).flat(),
        ),
      ),
    );
    const raw = sharp(frames, {
      raw: { width: 16, height: 16 * 21, channels: 3, pageHeight: 16 },
    });
    const bytes = await (
      format === "gif" ? raw.gif() : raw.webp({ lossless: true })
    ).toBuffer();
    const observed: number[] = [];
    const runtime = createRuntime(settings, services({}), {
      async classify(pixels) {
        expect(pixels.length).toBe(224 * 224 * 3);
        observed.push(pixels[0]!);
        return observed.length === 3
          ? { ...safeScores(), Neutral: 0.06, Porn: 0.91 }
          : safeScores();
      },
      dispose() {},
    });
    const result = await runtime.execute(input(file(bytes)), context());
    expect(observed).toEqual([0, 50, 100, 150, 200]);
    expect(result.disposition).toEqual({ value: "block" });
    expect(result.details).toMatchObject({
      totalFrames: 21,
      sampledFrames: 5,
      matchedCategories: ["Porn"],
      scores: { Porn: 0.91, Neutral: 0.96 },
    });
    await runtime.dispose?.();
  }
  expect(frameIndices(1, 5)).toEqual([0]);
  expect(frameIndices(3, 5)).toEqual([0, 1, 2]);
  expect(frameIndices(21, 1)).toEqual([0]);
});

test("static images become RGB on white without changing the source", async () => {
  const sharp = services({}).images.sharp;
  const bytes = await sharp({
    create: { width: 30, height: 10, channels: 4, background: "transparent" },
  })
    .png()
    .toBuffer();
  const copy = Buffer.from(bytes);
  const runtime = createRuntime(settings, services({}), {
    async classify(pixels) {
      expect(pixels.length).toBe(224 * 224 * 3);
      expect(pixels.every((byte) => byte === 255)).toBe(true);
      return safeScores();
    },
    dispose() {},
  });
  expect(
    (await runtime.execute(input(file(bytes)), context())).details,
  ).toMatchObject({ totalFrames: 1, sampledFrames: 1 });
  expect(bytes).toEqual(copy);
  await runtime.dispose?.();
});

test("oversize metadata and actual bytes, corrupt images and storage errors fail without passing", async () => {
  let called = false;
  const runtime = createRuntime(
    { ...settings, maxContentMiB: 1 },
    services({}),
    {
      async classify() {
        called = true;
        return safeScores();
      },
      dispose() {},
    },
  );
  const oversized = file(new Uint8Array(1024 ** 2 + 1));
  await expect(
    runtime.execute(input(oversized), context()),
  ).rejects.toMatchObject({ code: "RESOURCE_LIMIT", retryable: false });
  const unknownSize = {
    ...oversized,
    metadata: { ...oversized.metadata, byteSize: null },
  };
  await expect(
    runtime.execute(input(unknownSize), context()),
  ).rejects.toMatchObject({ code: "RESOURCE_LIMIT", retryable: false });
  await expect(
    runtime.execute(
      input(file(new TextEncoder().encode("not an image"))),
      context(),
    ),
  ).rejects.toMatchObject({ code: "INVALID_DATA", retryable: false });
  const failure = new PluginError("NETWORK", "Test storage failure", true);
  await expect(
    runtime.execute(
      input({
        ...file(new Uint8Array()),
        async openRead() {
          throw failure;
        },
      }),
      context(),
    ),
  ).rejects.toBe(failure);
  expect(called).toBe(false);
  await runtime.dispose?.();
});

test("queued cancellation does not read files; active cancellation releases the next execution", async () => {
  const started = Promise.withResolvers<void>();
  let calls = 0,
    disposed = 0,
    queuedReads = 0;
  const runtime = createRuntime(settings, services({}), {
    async classify(_pixels, signal) {
      if (++calls > 1) return safeScores();
      started.resolve();
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        }),
      );
    },
    dispose() {
      disposed++;
    },
  });
  const source = input(file(await image()));
  const active = new AbortController();
  const first = runtime.execute(source, context(active.signal));
  const firstRejected = first.catch((error) => error);
  await started.promise;
  const queued = new AbortController();
  const unread: FileInput = {
    ...source.file,
    async openRead() {
      queuedReads++;
      return source.file.openRead();
    },
  };
  const second = runtime.execute(input(unread), context(queued.signal));
  const secondRejected = second.catch((error) => error);
  queued.abort("queued cancelled");
  expect(await secondRejected).toBe("queued cancelled");
  active.abort("active cancelled");
  expect(await firstRejected).toBe("active cancelled");
  expect(queuedReads).toBe(0);
  expect(disposed).toBe(1);
  expect((await runtime.execute(source, context())).disposition?.value).toBe(
    "pass",
  );
  await runtime.dispose?.();
});

test("timeout is nonretryable; disposal cancels a pending read and releases its stream", async () => {
  let cancelled = 0;
  const pendingFile: FileInput = {
    metadata: file(new Uint8Array()).metadata,
    async openRead() {
      return new ReadableStream({
        cancel() {
          cancelled++;
        },
      });
    },
  };
  const classifier: Classifier = {
    async classify() {
      throw Error("unexpected");
    },
    dispose() {},
  };
  const timeout = createRuntime(
    { ...settings, timeoutMs: 20 },
    services({}),
    classifier,
  );
  await expect(
    timeout.execute(input(pendingFile), context()),
  ).rejects.toMatchObject({
    code: "FAILED",
    retryable: false,
    message: "NSFW moderation timed out",
  });
  expect(cancelled).toBe(1);
  const runtime = createRuntime(settings, services({}), classifier);
  const execution = runtime.execute(input(pendingFile), context());
  const rejected = execution.catch((error) => error);
  await Bun.sleep(5);
  await runtime.dispose?.();
  expect(await rejected).toBeInstanceOf(DOMException);
  expect(cancelled).toBe(2);
  await timeout.dispose?.();
});

test("defaults and English/Chinese setting labels are complete", () => {
  const fields = definition.stages.post_save!.configSchema!.properties!;
  expect(
    Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [key, field.default]),
    ),
  ).toEqual({ ...settings });
  for (const field of Object.values(fields)) {
    const hint = field["x-ui"]!;
    for (const key of [
      hint.labelKey,
      hint.descriptionKey,
      ...(hint.enumKeys ?? []),
    ].filter(Boolean)) {
      expect(definition.messages["en-US"]![key!]).toBeTruthy();
      expect(definition.messages["zh-CN"]![key!]).toBeTruthy();
    }
  }
});
