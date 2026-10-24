import { test, expect } from "bun:test";
import sharp from "sharp";
import { services, image } from "../../../tests/services";
import definition from "../src";
import { pipelineData } from "../../../tests/services";

const enabled = process.env.TENCENT_LIVE === "1";
(enabled ? test : test.skip)(
  "real Tencent Cloud moderation accepts an image and returns a summary",
  async () => {
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    const bizType = process.env.TENCENT_BIZ_TYPE;
    if (!secretId || !secretKey || !bizType)
      throw new Error(
        "Set TENCENT_SECRET_ID, TENCENT_SECRET_KEY and TENCENT_BIZ_TYPE",
      );
    const png = await image();
    try {
      const setup = {
        config: {
          submissionMode: "content",
          maxContentMiB: 5,
          blockAction: "block",
          timeoutMs: 30000,
          interval: 5,
          maxFrames: 5,
          bizType,
          region: process.env.TENCENT_REGION ?? "ap-guangzhou",
        },
        secretEdits: {
          "/secretId": { action: "replace", value: secretId },
          "/secretKey": { action: "replace", value: secretKey },
        },
      };
      const runtime = await definition.stages.post_save!.createInstance({
        id: "test",
        config: setup.config,
        services: services(
          Object.fromEntries(
            Object.entries(setup.secretEdits).map(([key, edit]) => [
              key.slice(1),
              edit.value,
            ]),
          ),
        ),
      });
      try {
        const png = await sharp({
          create: { width: 256, height: 256, channels: 3, background: "green" },
        })
          .png()
          .toBuffer();
        const result = await runtime.execute(
          {
            operationId: "live-test",
            record: {
              id: crypto.randomUUID(),
              createdAt: 1,
              origin: { kind: "upload" as const, userId: null },
              ownerId: null,
              organization: { tags: [], collections: [] },
            },
            url: "http://localhost/unused",
            publicPath: "/unused",
            currentDisposition: "pass" as const,
            previousResults: [],
            file: {
              metadata: {
                mimeType: "image/png",
                byteSize: png.length,
                width: 256,
                height: 256,
              },
              async openRead() {
                return new Blob([new Uint8Array(png)]).stream();
              },
            },
          },
          {
            signal: new AbortController().signal,
            requestId: "live-test",
            data: pipelineData(),
            organization: {
              async listTags() {
                return { items: [], total: 0 };
              },
              async listCollections() {
                return { items: [], total: 0 };
              },
              async ensureTag() {
                throw Error("Unexpected create");
              },
              async ensureCollection() {
                throw Error("Unexpected create");
              },
            },
            log() {},
          },
        );
        expect(["pass", "block", "delete"]).toContain(
          result.disposition!.value,
        );
        expect(typeof result.details?.requestId).toBe("string");
        expect(["Pass", "Review", "Block"]).toContain(
          String(result.details?.suggestion),
        );
      } finally {
        await runtime.dispose?.();
      }
    } finally {
    }
  },
  60000,
);
