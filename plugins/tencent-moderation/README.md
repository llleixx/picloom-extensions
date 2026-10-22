# Tencent Cloud image moderation

[English](README.md) | [简体中文](README.zh-CN.md)

Run Tencent Cloud moderation after saving and return a pass, block or delete decision.

`picloom.tencent-moderation` · `processor` · `post_save`

## Get started

[Install the ZIP](https://llleixx.github.io/picloom/guide/plugins.html), then add a post-save step in **Configuration → Pipelines**.

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

## Configuration

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

## Behavior and limitations

Moderation runs after publication, so an image may be accessible before the result arrives. `Pass` allows access, `Review` blocks it, and `Block` follows `blockAction`. Image details retain a summary of suggestions, labels, scores and the request ID.

Content exceeding the configured size limit fails moderation without automatic retry; this setting does not change Tencent limits. URL mode requires a public image domain reachable by Tencent. GIF moderation examines sampled frames only.
