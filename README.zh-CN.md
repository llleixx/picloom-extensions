# Picloom 官方扩展

本仓库维护可选插件 OpenList、NodeImage、Telegram 存储、腾讯云审核，以及 Horizon 主题。主程序保留默认主题与必要内置插件，SDK、工具和脚手架位于独立的 `picloom-tooling` 仓库；Telegram 通知仍在主仓库。

## 开发与验证

使用 Bun 1.4.3。SDK 和工具使用 npm 精确版本，无需相邻工具链仓库。在仓库根目录运行：

```sh
bun install --frozen-lockfile
bun run typecheck
bun run build
bun test plugins
```

插件和主题默认面向最新版 Picloom 维护。CI 仅使用公开 SDK 执行独立类型检查、单元测试和构建，不拉取或启动 Picloom 主仓库。

类型检查和构建分别执行，构建不再重复检查类型。插件统一调用 `@picloom/plugin-tools`，根命令从 workspace 目录发现扩展。

单独构建：`bun run build plugins/openlist` 或 `bun run build themes/horizon`。根构建会清理汇总 `dist/`，生成 ZIP、`SHA256SUMS` 和包元数据。也可进入扩展目录运行 `bun run build`；Horizon 支持 `bun run dev` 和 `bun run preview`。

通过 Picloom 插件／主题管理上传 ZIP。安装不会自动创建配置或启用主题；删除引用后可卸载，宿主重启不会重新安装。插件说明见各目录中英文 README；主题配置、素材来源及原始提示词见 [Horizon](themes/horizon/DESIGN.md)。

真实服务测试默认跳过。OpenList、Telegram、腾讯审核分别使用 `OPENLIST_LIVE=1`、`TELEGRAM_LIVE=1`、`TENCENT_LIVE=1` 开启；NodeImage 使用 `NODEIMAGE_TEST_KEY` 开启，其他变量见对应测试。测试可能产生真实对象或费用，模拟测试不能替代真实服务验证。凭据不写入源码或日志。

## 发布

清单是扩展版本的唯一来源，SDK、接口和宿主版本分别管理；API 1 不代表兼容所有宿主版本。手动发布工作流接收新标签和扩展路径，先执行独立检查和构建，再创建选定扩展的草稿 Release，附 SHA-256、SDK 信息。

已存在标签或已发布的扩展 ID／版本禁止覆盖，必须递增扩展版本。普通 CI 仅检查并上传构建产物。本地交付不创建远程仓库、不推送、不发布。

## 可选源码联调

正常安装直接运行 `bun install --frozen-lockfile`。需要验证工具链源码修改时，可从相邻 `picloom-tooling` 运行 `bun run dev:sync -- ../picloom-extensions`，临时切换成本地包。

验证结束后确认目标版本已发布，运行 `bun run dev:registry -- ../picloom-extensions`，再回本仓库运行 `bun install` 更新锁文件。分发 CI 使用 registry 版本，不使用本地压缩包。详见[工具链说明](https://github.com/llleixx/picloom-tooling/blob/main/README.zh-CN.md)。
