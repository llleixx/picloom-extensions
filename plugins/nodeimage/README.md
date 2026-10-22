# NodeImage Storage

[English](README.md) | [简体中文](README.zh-CN.md)

## Purpose

Host images through the NodeImage API.

`picloom.nodeimage` · `storage`

## Configuration

Defaults initialize new drafts only; saving does not fill missing values. Required fields must be present in the submitted configuration.

| Field       | Meaning              | Required | Default | Constraints     |
| ----------- | -------------------- | -------- | ------- | --------------- |
| `apiKey`    | API key              | Yes      | —       | secret          |
| `redirect`  | Redirect reads (302) | No       | `true`  | —               |
| `timeoutMs` | Timeout (ms)         | Yes      | `30000` | ≥ 100; ≤ 120000 |

No request parameters.

## Usage example

Enter a NodeImage API key and connect the source through a storage group to an upload profile. Verify the public link after uploading, deletion follows the platform limitation below.

```json
{
  "redirect": true,
  "timeoutMs": 30000,
  "apiKey": "YOUR_API_KEY"
}
```

## Behavior and limitations

Uses the fixed service `https://api.nodeimage.com`. Uploads collect content in memory for a multipart form; returned image IDs locate remote objects rather than Picloom directory paths. Reads allow redirects by default and also support streams. Enumeration is not provided. Missing upload results cannot be reliably recovered; with a locator, recovery checks remote metadata and size. NodeImage does not support image deletion. The plugin returns success immediately without a network request, allowing Picloom to complete local cleanup. Remote images remain on NodeImage; deleting a record in Picloom does not remove the remote image.

Build with `bun run build` in this directory; upload the ZIP from `dist/` in Picloom plugin management. Install dependencies with `bun install --frozen-lockfile` at the extensions repository root.
