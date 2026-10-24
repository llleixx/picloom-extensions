import { expect, spyOn, test } from "bun:test";
import { createHash, createHmac } from "node:crypto";
import { services, image } from "../../../tests/services";
import definition from "../src";
import { pipelineData } from "../../../tests/services";
import { PluginError } from "@picloom/plugin-sdk";

test("Tencent Cloud signs file submissions, maps decisions, stores safe summaries and classifies errors", async () => {
  const png = await image();
  let expectedBytes = png;
  let suggestion = "Pass",
    code = "",
    calls = 0,
    malformed = false;
  const fetcher = spyOn(globalThis, "fetch").mockImplementation((async (
    _url: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ) => {
    calls++;
    expect(String(_url)).toBe("https://ims.tencentcloudapi.com");
    expect(init!.redirect).toBe("error");
    const headers = new Headers(init!.headers);
    const body = JSON.parse(String(init!.body));
    expect(body).toMatchObject({
      BizType: "test",
      DataId: "file-id",
      Type: "IMAGE",
      Interval: 5,
      MaxFrames: 5,
    });
    expect(body.FileContent).toBe(expectedBytes.toString("base64"));
    expect(body.FileUrl).toBeUndefined();
    expect(headers.get("x-tc-action")).toBe("ImageModeration");
    expect(headers.get("x-tc-version")).toBe("2020-12-29");
    const date = new Date(Number(headers.get("x-tc-timestamp")) * 1000)
      .toISOString()
      .slice(0, 10);
    const digest = (s: string) => createHash("sha256").update(s).digest("hex");
    const canonical = [
      "POST",
      "/",
      "",
      "content-type:application/json\nhost:ims.tencentcloudapi.com\n",
      "content-type;host",
      digest(String(init!.body)),
    ].join("\n");
    let key = Buffer.from("TC3test-secret");
    for (const part of [date, "ims", "tc3_request"])
      key = Buffer.from(createHmac("sha256", key).update(part).digest());
    const sign = createHmac("sha256", key)
      .update(
        [
          "TC3-HMAC-SHA256",
          headers.get("x-tc-timestamp"),
          `${date}/ims/tc3_request`,
          digest(canonical),
        ].join("\n"),
      )
      .digest("hex");
    expect(headers.get("authorization")).toBe(
      `TC3-HMAC-SHA256 Credential=test-id/${date}/ims/tc3_request, SignedHeaders=content-type;host, Signature=${sign}`,
    );
    if (code)
      return Response.json({
        Response: {
          Error: { Code: code, Message: "Do not expose raw provider text" },
        },
      });
    if (malformed) return Response.json({ Response: {} });
    return Response.json({
      Response: {
        Suggestion: suggestion,
        Label: "Porn",
        SubLabel: "Test",
        Score: 82,
        RequestId: "request-id",
        LabelResults: [
          {
            Scene: "Porn",
            Label: "Porn",
            Score: 82,
            Suggestion: suggestion,
            Details: ["private"],
          },
        ],
        OcrResults: [{ Text: "private OCR text" }],
      },
    });
  }) as typeof fetch);
  try {
    const setup = {
      config: {
        region: "ap-guangzhou",
        submissionMode: "content",
        timeoutMs: 30000,
        interval: 5,
        maxFrames: 5,
        bizType: "test",
        blockAction: "delete",
        maxContentMiB: 8,
      },
      secretEdits: {
        "/secretId": { action: "replace", value: "test-id" },
        "/secretKey": { action: "replace", value: "test-secret" },
      },
    };
    expect(calls).toBe(0);
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
    const input = {
      operationId: "task:step",
      record: {
        id: "file-id",
        createdAt: 1,
        origin: { kind: "upload" as const, userId: null },
        ownerId: null,
        organization: { tags: [], collections: [] },
      },
      url: "http://localhost/i/test.png",
      publicPath: "/i/test.png",
      currentDisposition: "pass" as const,
      previousResults: [],
      file: {
        metadata: {
          mimeType: "image/png",
          byteSize: png.length,
          width: 40,
          height: 20,
        },
        async openRead() {
          return new Blob([new Uint8Array(expectedBytes)]).stream();
        },
      },
    };
    const ctx = {
      signal: new AbortController().signal,
      requestId: "test",
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
    };
    try {
      for (const [value, action] of [
        ["Pass", "pass"],
        ["Review", "block"],
        ["Block", "delete"],
      ] as const) {
        suggestion = value!;
        const result = await runtime.execute(input, ctx);
        expect(result.disposition!.value).toBe(action);
        expect(result.details).toMatchObject({
          suggestion,
          label: "Porn",
          score: 82,
          requestId: "request-id",
        });
        expect(JSON.stringify(result)).not.toContain("private");
      }
      for (const [value, expected, retryable] of [
        ["AuthFailure.SignatureFailure", "ACCESS_DENIED", false],
        ["ResourceUnavailable.ImageDownloadError", "SERVICE", false],
        ["InvalidParameter.ImageSizeTooSmall", "INVALID_INPUT", false],
        ["RequestLimitExceeded", "RATE_LIMITED", true],
        ["InternalError", "SERVICE", true],
      ] as const) {
        code = value;
        try {
          await runtime.execute(input, ctx);
          throw Error("Expected failure");
        } catch (error) {
          expect(error).toBeInstanceOf(PluginError);
          expect(error).toMatchObject({ code: expected, retryable });
        }
      }
      code = "";
      malformed = true;
      await expect(runtime.execute(input, ctx)).rejects.toMatchObject({
        code: "INVALID_DATA",
        retryable: false,
      });
      malformed = false;
      expectedBytes = Buffer.alloc(8 * 1024 * 1024, 1);
      await expect(
        runtime.execute(
          {
            ...input,
            file: {
              ...input.file,
              metadata: {
                ...input.file.metadata,
                byteSize: expectedBytes.length,
              },
            },
          },
          ctx,
        ),
      ).resolves.toMatchObject({ disposition: { value: "delete" } });
      const before = calls;
      const controller = new AbortController();
      controller.abort();
      await expect(
        runtime.execute(input, { ...ctx, signal: controller.signal }),
      ).rejects.toBeDefined();
      expect(calls).toBe(before);
    } finally {
      await runtime.dispose?.();
    }
  } finally {
    fetcher.mockRestore();
  }
});

test("Tencent URL mode submits only the public URL without reading or resolving the file", async () => {
  const png = await image();
  let calls = 0;
  const fetcher = spyOn(globalThis, "fetch").mockImplementation((async (
    url: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ) => {
    calls++;
    expect(String(url)).toBe("https://ims.tencentcloudapi.com");
    const body = JSON.parse(String(init!.body));
    expect(body.FileUrl).toBe("https://images.example.com/i/image%20name.svg");
    expect(body.FileContent).toBeUndefined();
    return Response.json({
      Response: { Suggestion: "Pass", RequestId: "url-test" },
    });
  }) as typeof fetch);
  try {
    const setup = {
      config: {
        region: "ap-guangzhou",
        maxContentMiB: 5,
        blockAction: "block",
        timeoutMs: 30000,
        interval: 5,
        maxFrames: 5,
        bizType: "test",
        submissionMode: "url",
      },
      secretEdits: {
        "/secretId": { action: "replace", value: "test-id" },
        "/secretKey": { action: "replace", value: "test-key" },
      },
    };
    expect(calls).toBe(0);
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
      const result = await runtime.execute(
        {
          operationId: "task:step",
          record: {
            id: "file-id",
            createdAt: 1,
            origin: { kind: "upload" as const, userId: null },
            ownerId: null,
            organization: { tags: [], collections: [] },
          },
          publicPath: "/i/image%20name.svg",
          currentDisposition: "pass" as const,
          previousResults: [],
          url: "https://images.example.com/i/image%20name.svg",
          file: {
            metadata: {
              mimeType: "image/svg+xml",
              byteSize: 40 * 1024 * 1024,
              width: null,
              height: null,
            },
            async openRead() {
              throw new Error("URL mode must not open the file");
            },
          },
        },
        {
          signal: new AbortController().signal,
          requestId: "test",
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
      expect(result.disposition!.value).toBe("pass");
      expect(calls).toBe(1);
    } finally {
      await runtime.dispose?.();
    }
  } finally {
    fetcher.mockRestore();
  }
});

test("content size limits reject declared and streamed oversize without contacting Tencent", async () => {
  const png = await image();
  const fetcher = spyOn(globalThis, "fetch").mockImplementation((async () => {
    throw new Error("Must not contact provider");
  }) as unknown as typeof fetch);
  try {
    const setup = {
      config: {
        region: "ap-guangzhou",
        submissionMode: "content",
        blockAction: "block",
        timeoutMs: 30000,
        interval: 5,
        maxFrames: 5,
        bizType: "test",
        maxContentMiB: 1,
      },
      secretEdits: {
        "/secretId": { action: "replace", value: "test-id" },
        "/secretKey": { action: "replace", value: "test-secret" },
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
    let opens = 0,
      cancelled = false;
    const input = {
      operationId: "test",
      record: {
        id: "file",
        createdAt: 1,
        origin: { kind: "upload" as const, userId: null },
        ownerId: null,
        organization: { tags: [], collections: [] },
      },
      url: "https://example.com/image",
      publicPath: "/image",
      currentDisposition: "pass" as const,
      previousResults: [],
      file: {
        metadata: {
          mimeType: "image/png",
          byteSize: (1024 * 1024 + 1) as number | null,
          width: 1,
          height: 1,
        },
        async openRead() {
          opens++;
          return new ReadableStream<Uint8Array>(
            {
              pull(controller) {
                controller.enqueue(new Uint8Array(600 * 1024));
              },
              cancel() {
                cancelled = true;
              },
            },
            { highWaterMark: 0 },
          );
        },
      },
    };
    const ctx = {
      signal: new AbortController().signal,
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
          throw Error("Unexpected create");
        },
        async ensureCollection() {
          throw Error("Unexpected create");
        },
      },
    };
    try {
      await expect(runtime.execute(input, ctx)).rejects.toMatchObject({
        code: "RESOURCE_LIMIT",
        retryable: false,
      });
      expect(opens).toBe(0);
      input.file.metadata.byteSize = null;
      await expect(runtime.execute(input, ctx)).rejects.toMatchObject({
        code: "RESOURCE_LIMIT",
        retryable: false,
      });
      expect(cancelled).toBe(true);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      await runtime.dispose?.();
    }
  } finally {
    fetcher.mockRestore();
  }
});
