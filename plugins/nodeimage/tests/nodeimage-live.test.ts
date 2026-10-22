import { test, expect } from "bun:test";
import sharp from "sharp";
import { services, image } from "../../../tests/services";
import definition from "../src";
const enabled = !!process.env.NODEIMAGE_TEST_KEY;
(enabled ? test : test.skip)(
  "real NodeImage upload, redirect, stream and local-only deletion",
  async () => {
    const png = await image();
    const runtime = await definition.createInstance({
      id: "live",
      config: { redirect: true, timeoutMs: 30000 },
      services: services({ apiKey: process.env.NODEIMAGE_TEST_KEY! }),
    });
    const ctx = {
      signal: AbortSignal.timeout(30000),
      requestId: "nodeimage-live",
      log() {},
    };
    const storageKey = "nodeimage-live.png";
    try {
      const existing = process.env.NODEIMAGE_TEST_LOCATOR;
      const { locator = null } = existing
        ? { locator: JSON.parse(existing) }
        : await runtime.write(
            {
              fileId: crypto.randomUUID(),
              operationId: crypto.randomUUID(),
              storageKey,
              file: {
                metadata: {
                  mimeType: "image/png",
                  byteSize: png.length,
                  width: 40,
                  height: 20,
                },
                async openRead() {
                  return new Blob([new Uint8Array(png)]).stream();
                },
              },
            },
            ctx,
          );
      expect(locator).not.toBeNull();
      const redirected = await runtime.read(
        { storageKey, locator, mode: "auto" },
        ctx,
      );
      expect(redirected.type).toBe("redirect");
      const streamed = await runtime.read(
        { storageKey, locator, mode: "stream" },
        ctx,
      );
      if (streamed.type !== "stream") throw Error("Expected stream");
      const bytes = Buffer.from(
        await new Response(streamed.stream).arrayBuffer(),
      );
      const resized = await sharp(bytes).resize({ width: 16 }).png().toBuffer();
      expect((await sharp(resized).metadata()).width).toBe(16);
      await runtime.delete(
        { storageKey, locator, operationId: crypto.randomUUID() },
        ctx,
      );
      console.log("NodeImage test object retained: deletion only cleans up local records");
    } finally {
      await runtime.dispose?.();
    }
  },
  60000,
);
