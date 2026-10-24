import { expect, test } from "bun:test";
import { WorkerClassifier, readScores } from "../src/classifier";
import { safeScores } from "./helpers";

const pixels = new Uint8Array(224 * 224 * 3).fill(128);
const predictions = Object.entries(safeScores()).map(
  ([className, probability]) => ({ className, probability }),
);

test("invalid or incomplete model predictions cannot pass", () => {
  for (const invalid of [
    null,
    [],
    predictions.slice(1),
    [...predictions.slice(1), predictions[1]],
    predictions.map((p) => ({ ...p, probability: NaN })),
    predictions.map((p) => ({ ...p, probability: 2 })),
  ]) {
    expect(() => readScores(invalid)).toThrow("Invalid NSFW model output");
  }
});

test("worker load errors and malformed responses are nonretryable; unexpected exit is retryable", async () => {
  for (const [source, expected] of [
    [
      'postMessage({type:"error",phase:"load"})',
      { code: "FAILED", retryable: false },
    ],
    [
      'postMessage({type:"ready"}); self.onmessage=()=>postMessage({type:"result", predictions: []})',
      { code: "INVALID_DATA", retryable: false },
    ],
    ["process.exit(1)", { code: "FAILED", retryable: true }],
  ] as const) {
    const classifier = new WorkerClassifier(source);
    try {
      await expect(
        classifier.classify(pixels, AbortSignal.timeout(2000)),
      ).rejects.toMatchObject(expected);
    } finally {
      classifier.dispose();
    }
  }
});

test("cancelled worker initialization and inference can be followed by a new worker", async () => {
  const source = `setTimeout(()=>postMessage({type:"ready"}),30); self.onmessage=()=>setTimeout(()=>postMessage({type:"result",predictions:${JSON.stringify(predictions)}}),30);`;
  const classifier = new WorkerClassifier(source);
  try {
    await expect(
      classifier.classify(pixels, AbortSignal.timeout(5)),
    ).rejects.toBeInstanceOf(DOMException);
    expect(
      await classifier.classify(pixels, AbortSignal.timeout(2000)),
    ).toEqual(safeScores());
    await expect(
      classifier.classify(pixels, AbortSignal.timeout(5)),
    ).rejects.toBeInstanceOf(DOMException);
    expect(
      await classifier.classify(pixels, AbortSignal.timeout(2000)),
    ).toEqual(safeScores());
  } finally {
    classifier.dispose();
  }
});

test("real bundled CPU model runs repeatedly without network while the main thread responds", async () => {
  // The prefix runs inside the worker as well as guarding the calling process.
  const { default: source } = await import("../.generated/worker");
  const classifier = new WorkerClassifier(
    `globalThis.fetch=()=>{throw new Error("Network disabled by test")};\n${source}`,
  );
  let ticks = 0;
  const timer = setInterval(() => ticks++, 10);
  try {
    const first = await classifier.classify(pixels, AbortSignal.timeout(15000));
    expect(Object.keys(first).sort()).toEqual([
      "Drawing",
      "Hentai",
      "Neutral",
      "Porn",
      "Sexy",
    ]);
    expect(Object.values(first).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
    const before = ticks;
    for (let i = 0; i < 3; i++)
      expect(
        await classifier.classify(pixels, AbortSignal.timeout(15000)),
      ).toEqual(first);
    expect(ticks).toBeGreaterThan(before + 3);
  } finally {
    clearInterval(timer);
    classifier.dispose();
  }
}, 30000);
