# Horizon · 远空

A Vue 3 theme for Picloom home and login pages, with four bundled anime landscape illustrations and a background slideshow.

以云海、星湖等二次元风景插画、背景轮换和半透明操作面板替换首页与登录页。管理后台继续使用 Picloom 默认界面。

## Install / 安装

Install `picloom.horizon-<version>.zip` as Owner in **Themes**, configure, preview and apply. Each version starts with its own defaults. Build the ZIP with the commands below.

以 Owner 在 **管理后台 → 主题** 安装 ZIP，配置、预览并应用。每个版本从自己的默认配置开始。ZIP 可按下方命令构建。

Site name, description, Logo, favicon and language are configured in **Site settings**. 网站名称、简介、Logo、favicon 和语言在 **站点设置** 中配置。详细步骤见[使用主题](https://llleixx.github.io/picloom/guide/themes.html)。

## Configuration / 配置

| Field / 字段 | Behavior / 行为 |
| --- | --- |
| Home heading / 首页标题 | Independent Chinese and English text / 独立的中英文宣传标题 |
| Home description / 首页说明 | Reads the current language’s site description from site settings / 使用站点设置中当前语言的站点简介 |
| Login heading and description / 登录标题与说明 | Independent localized theme fields / 独立的多语言主题配置 |
| Rotation / 自动轮换 | On by default, every 6 seconds; configurable from 5–60 seconds / 默认开启，每 6 秒轮换，可设为 5–60 秒 |
| Shade / 遮罩浓度 | Additional dark overlay for readability / 调整背景上的深色遮罩 |
| Backgrounds / 背景列表 | Add, remove and reorder scenes; each has an image address, optional localized name and accent palette / 可增删、排序；每项包含图片地址、可选双语名称和配色 |

The default list contains four local illustrations and needs no image service. Background addresses accept package asset paths or HTTP(S) URLs. Empty names use numbered labels. Failed images are skipped; an empty list or all failed images shows a gradient. Slideshow controls appear only with at least two loaded images. Rotation pauses when the document is hidden, and reduced-motion preference disables initial autoplay and transitions.

默认包含四张本地插画，无需图片服务。背景可填包内资源路径或 HTTP(S) 地址。名称留空显示编号；加载失败会跳过，列表为空或全部失败时显示渐变背景。至少两张图片加载成功才显示轮播控件。页面隐藏时暂停播放；减少动态效果偏好会关闭初始自动播放和过渡。

Cleared text stays empty without another language’s fallback. The theme does not change the site name, browser title or host light/dark preference. All theme configuration and assets may be public; do not store credentials in them. [Design and original image prompts / 设计与原始素材提示词](DESIGN.md) documents the illustrations and visual behavior.

清空的文案保持为空，不跨语言回退。主题不会修改站点名称、浏览器标题或宿主明暗偏好。主题配置和资源可能公开，不要保存凭据。

## Develop / 开发

Use Bun 1.4.3+. From the extensions repository root / 使用 Bun 1.4.3+，在扩展仓库根目录执行：

```sh
bun install --frozen-lockfile
bun run typecheck
bun run build themes/horizon
```

The root `dist/` contains the ZIP, `SHA256SUMS` and `packages.json`. For local UI work / 根目录 `dist/` 包含 ZIP、校验和和包元数据；本地界面开发：

```sh
cd themes/horizon
bun run dev
# Stop dev or use another terminal / 停止 dev 或另开终端
bun run typecheck
bun run build
bun run preview
```

`dev` listens on `http://127.0.0.1:5173`; use `bun run dev --port 5174` when occupied. Both local `dev` and `preview` use the simulated host from `@picloom/theme-tools`: uploads and login do not contact Picloom. `preview` loads the existing `dist/package/` output; rebuild after source changes. Type checking runs separately from builds.

本地 `dev` 与 `preview` 均由 `@picloom/theme-tools` 提供模拟宿主，上传和登录不连接 Picloom。默认端口 `5173`，占用时可用 `bun run dev --port 5174`。`preview` 读取已有 `dist/package/`，修改源码后须重新构建；类型检查独立执行。

Edit `src/Page.vue`, `src/style.css` and `theme.json`. `dev/config.json` is initialized from the theme’s Schema only when absent; later edits do not restore deleted values. Keep existing preview configuration in sync when adding fields.

修改 Vue 页面、样式和 `theme.json`。只有缺少 `dev/config.json` 时才按 Schema 默认值初始化；已有文件不补回被清空的值，新增字段后需自行调整本地配置。
