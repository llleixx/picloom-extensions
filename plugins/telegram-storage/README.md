# Telegram Storage

[English](README.md) | [简体中文](README.zh-CN.md)

Store originals as Telegram bot documents without photo compression.

`picloom.telegram-storage` · `storage`

## Get started

[Install the ZIP](https://llleixx.github.io/picloom/guide/plugins.html), then select this plugin in **Configuration → Storage sources**.

Create a bot, add it to the target chat and allow document sending. Set its token and numeric chat ID, then add the source to the upload profile’s storage group. Upload an image and check the chat document and public link.

```json
{
  "timeoutMs": 30000,
  "botToken": "123456:YOUR_BOT_TOKEN",
  "chatId": "-1001234567890"
}
```

## Configuration

Fields marked immutable cannot change after creation.

| Field       | Meaning      | Required | Default | Constraints     |
| ----------- | ------------ | -------- | ------- | --------------- |
| `botToken`  | Bot token    | Yes      | —       | secret          |
| `chatId`    | Chat ID      | Yes      | —       | immutable       |
| `timeoutMs` | Timeout (ms) | Yes      | `30000` | ≥ 100; ≤ 120000 |

## Behavior and limitations

Files are limited to 20,000,000 bytes. Picloom serves reads without exposing the bot token. Import is unsupported. Transient upload failures allow retries and may send duplicate documents. The chat ID cannot change after creation.

Deletion depends on message age and bot permissions. An explicit missing-message response completes deletion. If Telegram cannot delete the message (for example, after 48 hours), Picloom records deletion failure; manually end replica management to stop managing the retained message. Other API, authentication and network errors are reported.
