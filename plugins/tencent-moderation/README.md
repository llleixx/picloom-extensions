# Tencent Cloud image moderation

[English](README.md) | [简体中文](README.zh-CN.md)

## Purpose

Run Tencent Cloud moderation after saving and return a pass, block or delete decision.

`picloom.tencent-moderation` · `processor` · `post_save`

## Configuration

Defaults initialize new drafts only; saving does not fill missing values. Required fields must be present in the submitted configuration.

### `post_save`

| Field            | Meaning                  | Required | Default          | Constraints       |
| ---------------- | ------------------------ | -------- | ---------------- | ----------------- |
| `secretId`       | Secret ID                | Yes      | —                | secret            |
| `secretKey`      | Secret key               | Yes      | —                | secret            |
| `region`         | Region                   | Yes      | `"ap-guangzhou"` | —                 |
| `bizType`        | BizType                  | Yes      | —                | —                 |
| `submissionMode` | Submission method        | Yes      | `"content"`      | `content`, `url`  |
| `maxContentMiB`  | Content size limit (MiB) | Yes      | `5`              | ≥ 1; ≤ 20         |
| `blockAction`    | On violation             | Yes      | `"block"`        | `block`, `delete` |
| `timeoutMs`      | Timeout (ms)             | Yes      | `30000`          | ≥ 100; ≤ 120000   |
| `interval`       | GIF frame interval       | Yes      | `5`              | ≥ 1; ≤ 1000       |
| `maxFrames`      | Maximum GIF frames       | Yes      | `5`              | ≥ 1; ≤ 400        |

No request parameters.

## Usage example

Prepare Tencent Cloud credentials and a policy ID, add the instance to a post-save pipeline and select it in an upload profile. Content submission is the default. Upload a test image and inspect the moderation result in background tasks.

```json
{
  "region": "ap-guangzhou",
  "submissionMode": "content",
  "maxContentMiB": 5,
  "blockAction": "block",
  "timeoutMs": 30000,
  "interval": 5,
  "maxFrames": 5,
  "secretId": "YOUR_SECRET_ID",
  "secretKey": "YOUR_SECRET_KEY",
  "bizType": "YOUR_BIZ_TYPE"
}
```

## Behavior and limitations

`Pass` returns `pass`; `Review` always returns `block`; `Block` follows `blockAction`. `details` contains summaries such as suggestion, labels, scores and request ID, not full responses or raw OCR text. Content mode checks size before reading and Base64 encoding; oversized inputs fail without retry, and the setting does not change provider limits. URL mode requires a configured public origin and a URL accessible to Tencent Cloud. GIF moderation samples frames only. Moderation runs after saving, not before publication.

Build with `bun run build` in this directory; upload the ZIP from `dist/` in Picloom plugin management. Install dependencies with `bun install --frozen-lockfile` at the extensions repository root.
