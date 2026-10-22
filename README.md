# Picloom official extensions

Optional official plugins and themes. Install individual ZIPs using Picloom plugin/theme management. They use public SDKs and can be uninstalled once their references are removed.

| Extension          | Documentation                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| OpenList storage   | [English](plugins/openlist/README.md) · [中文](plugins/openlist/README.zh-CN.md)                     |
| NodeImage storage  | [English](plugins/nodeimage/README.md) · [中文](plugins/nodeimage/README.zh-CN.md)                   |
| Telegram storage   | [English](plugins/telegram-storage/README.md) · [中文](plugins/telegram-storage/README.zh-CN.md)     |
| Tencent moderation | [English](plugins/tencent-moderation/README.md) · [中文](plugins/tencent-moderation/README.zh-CN.md) |
| Horizon theme      | [Design, configuration and image provenance](themes/horizon/DESIGN.md)                               |

## Development

Use Bun 1.4.3. SDKs and tools use exact npm versions; no sibling tooling checkout is required. From the repository root:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run build
bun test plugins
```

Type checking and building are separate commands; builds do not repeat type checks. Plugin packages use the shared `@picloom/plugin-tools` CLI, and the root commands discover extensions from the workspace directories.

Build one extension with `bun run build plugins/openlist` or `bun run build themes/horizon`. Root builds clean the aggregate `dist/` directory and write ZIPs, `SHA256SUMS`, and `packages.json`. Each extension also supports `bun run build` in its own directory. Horizon supports `bun run dev` and `bun run preview`.

Plugins and themes are maintained for the latest Picloom. CI runs independent type checks, unit tests and builds using the public SDK packages; no Picloom checkout is required.

Provider live tests are skipped by default. Enable OpenList with `OPENLIST_LIVE=1`, Telegram with `TELEGRAM_LIVE=1`, Tencent with `TENCENT_LIVE=1`, or NodeImage with `NODEIMAGE_TEST_KEY`, and provide the variables documented in each test. These tests contact real services and may create billable or retained objects; unit mocks are not service validation. Never put credentials into the repository or logs.

## Release

Plugin/theme manifests own versions; package.json versions are not release identities. SDK, API and host versions are independent. API 1 alone does not guarantee compatibility with every host version.

The manual Release workflow accepts a new tag and extension paths, runs independent checks and builds, then prepares a draft Release containing selected ZIPs, SHA-256 checksums and SDK metadata. It refuses an existing tag or extension ID/version already published in any Release; increment the extension version instead of replacing bytes. Ordinary CI never publishes.

This local repository has not yet been pushed or published. Core retains the default theme and protocol examples. SDKs, tools and generators live in `picloom-tooling`. Horizon image provenance is preserved in its design document. Telegram notifications remain a core built-in plugin.

See [中文](README.zh-CN.md).

## Optional source integration

Normal installation uses `bun install --frozen-lockfile`. To test tooling source changes, run `bun run dev:sync -- ../picloom-extensions` from the sibling tooling repository to temporarily install local packages.

After validation, confirm the target versions are published, run `bun run dev:registry -- ../picloom-extensions` from tooling, then `bun install` here to refresh the lockfile. Distribution CI uses registry packages, not local tarballs. See [tooling documentation](https://github.com/llleixx/picloom-tooling/blob/main/README.md).
