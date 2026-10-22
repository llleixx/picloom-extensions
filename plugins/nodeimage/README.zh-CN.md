# NodeImage 存储

[English](README.md) | [简体中文](README.zh-CN.md)

## 用途

使用 NodeImage API 托管图片。

`picloom.nodeimage` · `storage`

## 配置

下表默认值仅用于生成初始草稿，保存时不补值；“必填”表示提交时必须存在，清空后须重新填写。

| 字段        | 含义                  | 必填 | 默认值  | 约束            |
| ----------- | --------------------- | ---- | ------- | --------------- |
| `apiKey`    | API 密钥              | 是   | —       | 敏感            |
| `redirect`  | 普通读取允许 302 跳转 | 否   | `true`  | —               |
| `timeoutMs` | 请求超时，毫秒        | 是   | `30000` | ≥ 100；≤ 120000 |

无请求参数。

## 使用示例

填写 NodeImage API 密钥，将存储源加入存储组并关联上传配置。上传后检查公开链接；删除时按下述平台限制处理。

```json
{
  "redirect": true,
  "timeoutMs": 30000,
  "apiKey": "YOUR_API_KEY"
}
```

## 行为与限制

使用固定服务 `https://api.nodeimage.com`。上传在内存中收集内容后提交 multipart 表单，远端对象由返回的图片 ID 定位，不按 Picloom 路径建立目录。默认允许跳转读取，也支持内容流。不提供枚举。缺少上传结果时无法可靠恢复；有定位信息时检查远端信息与大小。NodeImage 不支持删除图片。插件删除操作不发送网络请求，直接返回成功，让 Picloom 完成本地清理。远端图片仍保留在 NodeImage，删除 Picloom 记录不会删除远端图片。

独立构建：在本目录执行 `bun run build`；在 Picloom 插件管理中上传 `dist/` 中的 ZIP。依赖安装在扩展仓库根目录执行 `bun install --frozen-lockfile`。
