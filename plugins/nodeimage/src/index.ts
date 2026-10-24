import manifest from "../plugin.json";
import { isPluginError } from "@picloom/plugin-sdk";
import {
  PluginError,
  type Definition,
  type Locator,
} from "@picloom/plugin-sdk";

const apiOrigin = "https://api.nodeimage.com";
function locatorId(storageKey: string, locator: Locator): string {
  const id =
    locator === null
      ? storageKey
      : typeof locator === "object"
        ? locator.imageId
        : undefined;
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id))
    throw new PluginError("INVALID_INPUT", "Invalid NodeImage image ID", false);
  return id;
}
function imageUrl(value: unknown): string {
  if (typeof value !== "string")
    throw new PluginError("INVALID_DATA", "Missing NodeImage image URL");
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw 0;
    return url.href;
  } catch {
    throw new PluginError("INVALID_DATA", "Invalid NodeImage image URL");
  }
}
export const nodeImageStorage: Definition<"storage"> = {
  defaultLocale: "en-US",
  nameKey: "package.name",
  descriptionKey: "package.description",
  messages: {
    "en-US": {
      "package.name": "NodeImage Storage",
      "package.description":
        "Store images on NodeImage. Remote deletion is unsupported; failed deletion requires manually marking the replica as deleted.",
      "settings.apiKey.label": "API key",
      "settings.redirect.label": "Redirect reads (302)",
      "settings.timeoutMs.label": "Timeout (ms)",
    },
    "zh-CN": {
      "package.name": "NodeImage 存储",
      "package.description":
        "使用 NodeImage 存储图片。不支持远端删除；删除失败后需将副本人工标记为已删除。",
      "settings.apiKey.label": "API 密钥",
      "settings.redirect.label": "302 重定向",
      "settings.timeoutMs.label": "超时（毫秒）",
    },
  },

  id: manifest.id,

  kind: "storage",
  version: manifest.version,
  apiVersion: 1,
  configSchemaVersion: 1,
  configSchema: {
    type: "object",
    properties: {
      apiKey: {
        "x-ui": { labelKey: "settings.apiKey.label" },
        type: "string",

        minLength: 1,
        "x-sensitive": true,
      },
      redirect: {
        "x-ui": { labelKey: "settings.redirect.label" },
        type: "boolean",

        default: true,
      },
      timeoutMs: {
        "x-ui": { labelKey: "settings.timeoutMs.label", advanced: true },
        type: "integer",

        minimum: 100,
        maximum: 120000,
        default: 30000,
      },
    },
    required: ["apiKey", "redirect", "timeoutMs"],
    additionalProperties: false,
  },

  async createInstance({ config, services }) {
    const signalFor = (signal: AbortSignal) =>
      AbortSignal.any([signal, AbortSignal.timeout(Number(config.timeoutMs))]);
    async function request(
      path: string,
      init: RequestInit,
      signal: AbortSignal,
    ) {
      const secrets = (await services.readSecrets()).value;
      return fetch(apiOrigin + path, {
        ...init,
        redirect: "error",
        signal,
        headers: { "X-API-Key": String(secrets.apiKey) },
      });
    }
    async function info(id: string, signal: AbortSignal) {
      const response = await request(
        "/api/image/" + encodeURIComponent(id),
        {},
        signal,
      );
      const value = await response.json().catch(() => null);
      if (response.status === 404 && value?.error === "Image not found")
        return null;
      if (!response.ok) throw httpError(response.status);
      if (value?.image_id !== id || typeof value?.size !== "number")
        throw new PluginError(
          "INVALID_DATA",
          "Invalid NodeImage image metadata",
        );
      return {
        imageId: id,
        url: imageUrl(value.links?.direct),
        size: value.size,
      };
    }
    function httpError(status: number) {
      return new PluginError(
        status === 401 || status === 403
          ? "ACCESS_DENIED"
          : status === 429
            ? "RATE_LIMITED"
            : "SERVICE",
        "NodeImage rejected the request",
        status === 408 || status === 429 || status >= 500,
      );
    }
    return {
      async write({ fileId, storageKey, file }, ctx) {
        ctx.signal.throwIfAborted();
        const signal = signalFor(ctx.signal);
        // NodeImage accepts multipart, not a user-selected object key.
        const stream = await file.openRead();
        const reader = stream.getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        const abort = () => {
          void reader.cancel().catch(() => {});
        };
        signal.addEventListener("abort", abort, { once: true });
        try {
          while (true) {
            signal.throwIfAborted();
            const { value, done } = await reader.read();
            signal.throwIfAborted();
            if (done) break;
            chunks.push(new Uint8Array(value));
          }
        } catch {
          throw new PluginError(
            "FAILED",
            "Could not prepare NodeImage upload",
            true,
          );
        } finally {
          signal.removeEventListener("abort", abort);
          await reader.cancel();
          reader.releaseLock();
        }
        const extension = storageKey.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "";
        const form = new FormData();
        form.set(
          "image",
          new File(chunks, fileId + extension, {
            type: file.metadata.mimeType ?? "application/octet-stream",
          }),
        );
        try {
          const response = await request(
            "/api/upload",
            { method: "POST", body: form },
            signal,
          );
          if (!response.ok) {
            await response.body?.cancel();
            throw httpError(response.status);
          }
          const data = await response.json();
          if (
            data?.success !== true ||
            typeof data.image_id !== "string" ||
            !/^[a-zA-Z0-9_-]+$/.test(data.image_id)
          )
            throw new PluginError(
              "INVALID_DATA",
              "Invalid NodeImage upload result",
              false,
            );
          return {
            locator: {
              imageId: data.image_id,
              url: imageUrl(data.links?.direct),
            },
          };
        } catch (error) {
          if (isPluginError(error)) throw error;
          // Retrying may create another remote object.
          throw new PluginError(
            "NETWORK",
            "NodeImage upload request failed",
            true,
          );
        }
      },
      async read({ storageKey, locator, mode }, ctx) {
        ctx.signal.throwIfAborted();
        const signal = signalFor(ctx.signal);
        const id = locatorId(storageKey, locator);
        const url =
          locator && typeof locator === "object" && locator.url
            ? imageUrl(locator.url)
            : (await info(id, signal))?.url;
        if (!url)
          throw new PluginError("NOT_FOUND", "NodeImage image not found");
        if (mode === "auto" && config.redirect !== false)
          return { type: "redirect", url };
        const response = await fetch(url, { signal }); // Never send API credentials to the CDN.
        if (!response.ok || !response.body) {
          await response.body?.cancel();
          throw new PluginError(
            "SERVICE",
            "NodeImage download failed",
            response.status >= 500,
          );
        }
        const length = response.headers.get("content-length");
        return {
          type: "stream",
          stream: response.body,
          mimeType: response.headers.get("content-type") ?? undefined,
          byteSize:
            length !== null && /^\d+$/.test(length)
              ? Number(length)
              : undefined,
        };
      },
      async delete() {
        throw new PluginError(
          "UNSUPPORTED",
          "NodeImage does not support remote deletion",
        );
      },
    };
  },
};

export default nodeImageStorage;
