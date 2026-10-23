# NodeImage Storage

[English](README.md) | [简体中文](README.zh-CN.md)

Host images through the NodeImage API.

`picloom.nodeimage` · `storage`

## Get started

[Install the ZIP](https://llleixx.github.io/picloom/guide/plugins.html), then select this plugin in **Configuration → Storage sources**.

Enter a NodeImage API key and connect the source through a storage group to an upload profile. Verify the public link after uploading, deletion follows the platform limitation below.

```json
{
  "redirect": true,
  "timeoutMs": 30000,
  "apiKey": "YOUR_API_KEY"
}
```

## Configuration

| Field       | Meaning              | Required | Default | Constraints     |
| ----------- | -------------------- | -------- | ------- | --------------- |
| `apiKey`    | API key              | Yes      | —       | secret          |
| `redirect`  | Redirect reads (302) | No       | `true`  | —               |
| `timeoutMs` | Timeout (ms)         | Yes      | `30000` | ≥ 100; ≤ 120000 |

## Behavior and limitations

Uses `https://api.nodeimage.com`. Reads redirect to the remote image by default; disable `redirect` to serve content through Picloom. Existing images cannot be imported. Transient upload failures can retry and may create duplicate remote images.

Remote deletion is unsupported. Deletion fails in Picloom; manually end replica management to stop managing the retained remote image.
