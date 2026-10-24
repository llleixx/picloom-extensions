import manifest from "../plugin.json";
import type { Definition } from "@picloom/plugin-sdk";
import { createRuntime, type Settings } from "./runtime";
export { thirdPartyNotices } from "../.generated/worker";

const definition: Definition<"processor"> = {
  id: manifest.id,
  version: manifest.version,
  kind: "processor",
  apiVersion: 1,
  defaultLocale: "en-US",
  nameKey: "package.name",
  descriptionKey: "package.description",
  messages: {
    "en-US": {
      "package.name": "Local NSFW Moderation",
      "package.description":
        "Review images locally with an offline NSFW model after saving.",
      "settings.categories.label": "Categories",
      "settings.categories.description":
        "Any selected category reaching the threshold in a sampled frame is a match.",
      "settings.categories.porn": "Pornography (Porn)",
      "settings.categories.hentai": "Pornographic illustrations (Hentai)",
      "settings.categories.sexy": "Suggestive content (Sexy)",
      "settings.threshold.label": "Threshold",
      "settings.threshold.description":
        "Per-category score, not an accuracy guarantee. Scores are not added together.",
      "settings.blockAction.label": "On match",
      "settings.blockAction.block": "Block access",
      "settings.blockAction.delete": "Delete",
      "settings.maxFrames.label": "Maximum sampled frames",
      "settings.maxFrames.description":
        "Evenly sample frame indices, including the first and last; 1 checks only the first. Unsampled frames are not reviewed.",
      "settings.maxContentMiB.label": "Content size limit (MiB)",
      "settings.maxContentMiB.description":
        "Oversized images fail moderation without retry. An error does not automatically block access.",
      "settings.timeoutMs.label": "Timeout (ms)",
      "settings.timeoutMs.description":
        "Covers model loading, reading, decoding and inference after waiting for an execution slot.",
    },
    "zh-CN": {
      "package.name": "本地 NSFW 审核",
      "package.description": "图片保存后使用离线 NSFW 模型在本机审核。",
      "settings.categories.label": "检测类别",
      "settings.categories.description":
        "任一抽样帧的任一选定类别达到阈值即命中。",
      "settings.categories.porn": "色情（Porn）",
      "settings.categories.hentai": "色情动漫（Hentai）",
      "settings.categories.sexy": "性感内容（Sexy）",
      "settings.threshold.label": "命中阈值",
      "settings.threshold.description":
        "按单个类别分数判断，不代表准确率；不同类别分数不相加。",
      "settings.blockAction.label": "命中处置",
      "settings.blockAction.block": "屏蔽",
      "settings.blockAction.delete": "删除",
      "settings.maxFrames.label": "最大抽帧数",
      "settings.maxFrames.description":
        "按帧序号均匀取样并包含首尾帧；设为 1 时只审首帧。未抽中的帧不在审核范围内。",
      "settings.maxContentMiB.label": "文件读取上限（MiB）",
      "settings.maxContentMiB.description":
        "超限时审核失败且不重试；审核错误不会自动屏蔽图片。",
      "settings.timeoutMs.label": "执行超时（毫秒）",
      "settings.timeoutMs.description":
        "取得执行名额后开始计时，包含模型加载、读取、解码和推理。",
    },
  },
  stages: {
    post_save: {
      configSchemaVersion: 1,
      configSchema: {
        type: "object",
        properties: {
          categories: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            uniqueItems: true,
            items: {
              type: "string",
              enum: ["Porn", "Hentai", "Sexy"],
              "x-ui": {
                enumKeys: [
                  "settings.categories.porn",
                  "settings.categories.hentai",
                  "settings.categories.sexy",
                ],
              },
            },
            default: ["Porn", "Hentai"],
            "x-ui": {
              labelKey: "settings.categories.label",
              descriptionKey: "settings.categories.description",
            },
          },
          threshold: {
            type: "number",
            exclusiveMinimum: 0,
            maximum: 1,
            default: 0.8,
            "x-ui": {
              labelKey: "settings.threshold.label",
              descriptionKey: "settings.threshold.description",
            },
          },
          blockAction: {
            type: "string",
            enum: ["block", "delete"],
            default: "block",
            "x-ui": {
              labelKey: "settings.blockAction.label",
              enumKeys: [
                "settings.blockAction.block",
                "settings.blockAction.delete",
              ],
            },
          },
          maxFrames: {
            type: "integer",
            minimum: 1,
            maximum: 10,
            default: 5,
            "x-ui": {
              labelKey: "settings.maxFrames.label",
              descriptionKey: "settings.maxFrames.description",
            },
          },
          maxContentMiB: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 20,
            "x-ui": {
              labelKey: "settings.maxContentMiB.label",
              descriptionKey: "settings.maxContentMiB.description",
              advanced: true,
            },
          },
          timeoutMs: {
            type: "integer",
            minimum: 1000,
            maximum: 120000,
            default: 30000,
            "x-ui": {
              labelKey: "settings.timeoutMs.label",
              descriptionKey: "settings.timeoutMs.description",
              advanced: true,
            },
          },
        },
        required: [
          "categories",
          "threshold",
          "blockAction",
          "maxFrames",
          "maxContentMiB",
          "timeoutMs",
        ],
        additionalProperties: false,
      },
      async createInstance({ config, services }) {
        return createRuntime(config as unknown as Settings, services);
      },
    },
  },
};
export default definition;
