import { test, expect, spyOn } from "bun:test";
import { services, image } from "../../../tests/services";
import definition from "../src";

test("NodeImage storage: upload, redirect, stream, retryable writes and unsupported deletion", async () => {
  const png = await image();
  let uploads = 0,
    downloads = 0,
    lostResponse = false;
  const remoteId = "nodeimage-test-id";
  const url = "https://cdn.nodeimage.com/i/test.png";
  const fetcher = spyOn(globalThis, "fetch").mockImplementation((async (
    input,
    init,
  ) => {
    const address = String(input);
    if (address === url) {
      expect(new Headers(init?.headers).has("X-API-Key")).toBe(false);
      downloads++;
      return new Response(new Uint8Array(png), {
        headers: {
          "content-type": "image/png",
          "content-length": String(png.length),
        },
      });
    }
    expect(new Headers(init?.headers).get("X-API-Key")).toBe("test-key");
    expect(init?.redirect).toBe("error");
    if (address.endsWith("/api/upload")) {
      uploads++;
      if (lostResponse)
        throw new TypeError("network error containing private details");
      const image = (init?.body as FormData).get("image") as File;
      expect(image.type).toBe("image/png");
      expect(Buffer.from(await image.arrayBuffer()).equals(png)).toBe(true);
      return Response.json({
        success: true,
        image_id: remoteId,
        links: { direct: url },
      });
    }
    expect(address).toBe("https://api.nodeimage.com/api/image/" + remoteId);
    expect(init?.method).not.toBe("DELETE");
    return Response.json({
      image_id: remoteId,
      size: png.length,
      links: { direct: url },
    });
  }) as typeof fetch);
  try {
    const runtime = await definition.createInstance({
      id: "test",
      config: { redirect: true, timeoutMs: 30000 },
      services: services({ apiKey: "test-key" }),
    });
    const ctx = {
      signal: AbortSignal.timeout(5000),
      requestId: "test",
      log() {},
    };
    const written = await runtime.write(
      {
        operationId: "first",
        fileId: "file",
        storageKey: "a.png",
        file: {
          metadata: {
            byteSize: png.length,
            mimeType: "image/png",
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
    expect(written.locator).toMatchObject({ imageId: remoteId, url });
    const stream = await runtime.read(
      { storageKey: "a.png", locator: written.locator!, mode: "stream" },
      ctx,
    );
    if (stream.type !== "stream") throw Error("Expected stream");
    expect(
      Buffer.from(await new Response(stream.stream).arrayBuffer()).equals(png),
    ).toBe(true);
    expect(downloads).toBe(1);
    try {
      expect(
        await runtime.read(
          { storageKey: remoteId, locator: null, mode: "auto" },
          ctx,
        ),
      ).toMatchObject({ type: "redirect", url });
      lostResponse = true;
      await expect(
        runtime.write(
          {
            operationId: "op",
            fileId: "id",
            storageKey: "a.png",
            file: {
              metadata: {
                byteSize: png.length,
                mimeType: "image/png",
                width: 40,
                height: 20,
              },
              async openRead() {
                return new Blob([new Uint8Array(png)]).stream();
              },
            },
          },
          ctx,
        ),
      ).rejects.toMatchObject({
        code: "NETWORK",
        retryable: true,
      });
      expect(uploads).toBe(2);
    } finally {
    }
    try {
      const requestsBeforeDeletion = fetcher.mock.calls.length;
      for (const locator of [{ imageId: remoteId, url }, null]) {
        await expect(
          runtime.delete(
            { operationId: "cleanup", storageKey: "a.png", locator },
            ctx,
          ),
        ).rejects.toMatchObject({ code: "UNSUPPORTED", retryable: false });
      }
      expect(fetcher.mock.calls.length).toBe(requestsBeforeDeletion);
    } finally {
      await runtime.dispose?.();
    }
  } finally {
    fetcher.mockRestore();
  }
});
