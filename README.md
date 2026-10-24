# Picloom official extensions

Optional official plugins and themes. Install individual ZIPs using Picloom plugin/theme management. They use public SDKs and can be uninstalled once their references are removed.

| Extension          | Documentation                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| OpenList storage   | [English](plugins/openlist/README.md) · [中文](plugins/openlist/README.zh-CN.md)                     |
| NodeImage storage  | [English](plugins/nodeimage/README.md) · [中文](plugins/nodeimage/README.zh-CN.md)                   |
| Telegram storage   | [English](plugins/telegram-storage/README.md) · [中文](plugins/telegram-storage/README.zh-CN.md)     |
| Tencent moderation | [English](plugins/tencent-moderation/README.md) · [中文](plugins/tencent-moderation/README.zh-CN.md) |
| Local NSFW moderation | [English](plugins/nsfw-moderation/README.md) · [中文](plugins/nsfw-moderation/README.zh-CN.md) |
| Horizon theme      | [Usage and development](themes/horizon/README.md) · [Image provenance](themes/horizon/DESIGN.md) |

## Get and install

Install an extension ZIP as Owner through Picloom plugin or theme management. Configure plugins and connect them to upload profiles; configure and apply themes to activate them. See [plugin installation (中文)](https://llleixx.github.io/picloom/guide/plugins.html) and [theme installation (中文)](https://llleixx.github.io/picloom/guide/themes.html). To build ZIPs from source, use the commands below.

## Development

Use Bun 1.4.4. SDKs and tools use exact npm versions; no sibling tooling checkout is required. From the repository root:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run test
```

Type checking and building are separate commands; builds do not repeat type checks. Plugin packages use the shared `@picloom/plugin-tools` CLI, and the root commands discover extensions from the workspace directories.

Build one extension with `bun run build plugins/openlist` or `bun run build themes/horizon`. Root builds clean the aggregate `dist/` directory and write ZIPs, `SHA256SUMS`, and `packages.json`. Each extension also supports `bun run build` in its own directory. Horizon supports `bun run dev` and `bun run preview`.

Provider live tests are skipped by default. Enable OpenList with `OPENLIST_LIVE=1`, Telegram with `TELEGRAM_LIVE=1`, Tencent with `TENCENT_LIVE=1`, or NodeImage with `NODEIMAGE_TEST_KEY`, and provide the variables documented in each test. These tests contact real services and may create billable or retained objects; unit mocks are not service validation. Never put credentials into the repository or logs.
