import type { FileInput, PostSavePlugin } from "@picloom/plugin-sdk";
import { pipelineData } from "../../../tests/services";
import type { Settings } from "../src/runtime";
import type { Scores } from "../src/classifier";

export const settings: Settings = {
  categories: ["Porn", "Hentai"],
  threshold: 0.8,
  blockAction: "block",
  maxFrames: 5,
  maxContentMiB: 20,
  timeoutMs: 30000,
};
export const safeScores = (): Scores => ({
  Drawing: 0.01,
  Hentai: 0.01,
  Neutral: 0.96,
  Porn: 0.01,
  Sexy: 0.01,
});
export function file(bytes: Uint8Array): FileInput {
  return {
    metadata: {
      byteSize: bytes.length,
      mimeType: null,
      width: null,
      height: null,
    },
    async openRead() {
      return new Blob([new Uint8Array(bytes)]).stream();
    },
  };
}
export function input(
  source: FileInput,
): Parameters<PostSavePlugin["execute"]>[0] {
  return {
    operationId: "task:step",
    record: {
      id: "file",
      createdAt: 1,
      origin: { kind: "upload", userId: null },
      ownerId: null,
      organization: { tags: [], collections: [] },
    },
    url: "/i/test",
    publicPath: "/i/test",
    currentDisposition: "pass",
    previousResults: [],
    file: source,
  };
}
export function context(
  signal = new AbortController().signal,
): Parameters<PostSavePlugin["execute"]>[1] {
  return {
    signal,
    requestId: "test",
    log() {},
    data: pipelineData(),
    organization: {
      async listTags() {
        return { items: [], total: 0 };
      },
      async listCollections() {
        return { items: [], total: 0 };
      },
      async ensureTag() {
        throw Error("Unexpected organization write");
      },
      async ensureCollection() {
        throw Error("Unexpected organization write");
      },
    },
  };
}
