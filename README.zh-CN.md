# Picloom 官方扩展

[English](README.md) · **简体中文**

本仓库维护可选插件 OpenList、NodeImage、Telegram 存储、腾讯云审核，以及 Horizon 主题。主程序保留默认主题与必要内置插件，SDK、工具和脚手架位于独立的 `picloom-tooling` 仓库；Telegram 通知仍在主仓库。

## 扩展列表

| 扩展 | ID | 说明 |
| --- | --- | --- |
| OpenList 存储 | `picloom.openlist` | [配置与限制](plugins/openlist/README.zh-CN.md) |
| NodeImage 存储 | `picloom.nodeimage` | [配置与限制](plugins/nodeimage/README.zh-CN.md) |
| Telegram 存储 | `picloom.telegram-storage` | [配置与限制](plugins/telegram-storage/README.zh-CN.md) |
| 腾讯云图片审核 | `picloom.tencent-moderation` | [配置与限制](plugins/tencent-moderation/README.zh-CN.md) |
| Horizon 主题 | `picloom.horizon` | [使用与开发](themes/horizon/README.md) · [素材来源](themes/horizon/DESIGN.md) |

## 获取与安装

准备扩展 ZIP，由 Owner 在 Picloom 的插件或主题管理中安装。插件需创建配置并接入上传配置；主题需配置后应用到网站。完整步骤见[安装插件](https://llleixx.github.io/picloom/guide/plugins.html)和[使用主题](https://llleixx.github.io/picloom/guide/themes.html)。可按下方命令从源码构建 ZIP。

## 开发与验证

使用 Bun 1.4.4。SDK 和工具使用 npm 精确版本，无需相邻工具链仓库。在仓库根目录运行：

```sh
bun install --frozen-lockfile
bun run typecheck
bun run build
bun test plugins
```

类型检查和构建分别执行，构建不再重复检查类型。插件统一调用 `@picloom/plugin-tools`，根命令从 workspace 目录发现扩展。

单独构建：`bun run build plugins/openlist` 或 `bun run build themes/horizon`。根构建会清理汇总 `dist/`，生成 ZIP、`SHA256SUMS` 和包元数据。也可进入扩展目录运行 `bun run build`；Horizon 支持 `bun run dev` 和 `bun run preview`。

真实服务测试默认跳过。OpenList、Telegram、腾讯审核分别使用 `OPENLIST_LIVE=1`、`TELEGRAM_LIVE=1`、`TENCENT_LIVE=1` 开启；NodeImage 使用 `NODEIMAGE_TEST_KEY` 开启，其他变量见对应测试。测试可能产生真实对象或费用，模拟测试不能替代真实服务验证。凭据不写入源码或日志。
