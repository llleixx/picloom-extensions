# OpenList Storage

[English](README.md) | [简体中文](README.zh-CN.md)

Use storage mounted in OpenList through its API.

`picloom.openlist` · `storage`

## Get started

[Install the ZIP](https://llleixx.github.io/picloom/guide/plugins.html), then select this plugin in **Configuration → Storage sources**.

Set the OpenList service URL, mount directory and API token. Add the source to the upload profile’s storage group, then upload an image and verify the mounted directory and returned link.

```json
{
  "redirect": true,
  "timeoutMs": 30000,
  "endpoint": "https://openlist.example.com",
  "root": "/Images",
  "token": "YOUR_API_TOKEN"
}
```

To register existing images, choose **Import** on the storage source page. The scan scope is a directory relative to `root`; leave it empty to scan the whole mount directory. With `root=/Images` and scope `2026`, `/Images/2026/photo.jpg` retains the storage key `2026/photo.jpg`. Setting public-path directory stripping to `1` uses `photo.jpg` for the public path without moving the remote file.

## Configuration

Fields marked immutable cannot change after creation.

| Field       | Meaning              | Required | Default | Constraints     |
| ----------- | -------------------- | -------- | ------- | --------------- |
| `endpoint`  | Endpoint             | Yes      | —       | immutable       |
| `root`      | Mount directory      | Yes      | —       | immutable       |
| `token`     | API token            | Yes      | —       | secret          |
| `redirect`  | Redirect reads (302) | Yes      | `true`  | —               |
| `timeoutMs` | Timeout (ms)         | Yes      | `30000` | ≥ 100; ≤ 120000 |

## Behavior and limitations

Supports upload, read, delete and import, subject to the upstream mount. Reads redirect to the upstream download URL by default; disable `redirect` to serve content through Picloom. Download URLs must work without the API token. The endpoint and root cannot change after creation.

Deletion requires the object location saved after a successful write or import. Missing location causes deletion failure; use [image management](https://llleixx.github.io/picloom/guide/files.html) to remove the reference while retaining the remote file.

Import requires directory access and does not accept a separate directory password. Scans use OpenList listings, which may be cached. Network failures, timeouts, rate limits and upstream server errors allow retries; an interrupted or timed-out write may already have saved the object, so retries can create duplicates.
