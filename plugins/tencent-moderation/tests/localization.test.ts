import { test, expect } from "bun:test";
import definition from "../src";
test("submission options retain authored English and Chinese labels", () => {
  const field =
    definition.stages.post_save!.configSchema!.properties!.submissionMode!;
  const keys = field["x-ui"]!.enumKeys!;
  expect(keys.map((k) => definition.messages["en-US"]![k])).toEqual([
    "File content",
    "Public URL",
  ]);
  expect(keys.map((k) => definition.messages["zh-CN"]![k])).toEqual([
    "文件内容",
    "公开 URL",
  ]);
});
