# Local NSFW Moderation

**English** · [简体中文](README.zh-CN.md)

Review pornography, pornographic illustrations and optional suggestive content on the server CPU using the bundled NSFWJS MobileNetV2 model. No GPU, external service or credentials are needed. Runtime inference neither downloads models nor sends images to third parties.

`picloom.nsfw-moderation` · `processor` · `post_save`

## Get started

[Install the ZIP (中文)](https://llleixx.github.io/picloom/guide/plugins.html), add this plugin to a post-save pipeline in **Configuration → Pipelines**, select categories, threshold and action, then connect the pipeline to an upload profile.

Upload a test image and check its review result in image details. Matches block access by default; deletion is optional. Place notification plugins after moderation.

Default configuration:

```json
{
  "categories": ["Porn", "Hentai"],
  "threshold": 0.8,
  "blockAction": "block",
  "maxFrames": 5,
  "maxContentMiB": 20,
  "timeoutMs": 30000
}
```

## Configuration

| Field | Meaning | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| `categories` | Categories | Yes | `Porn`, `Hentai` | Pornography and pornographic illustrations; optionally `Sexy` for suggestive content; select at least one |
| `threshold` | Match threshold | Yes | `0.8` | Greater than 0 and at most 1, shared by selected categories |
| `blockAction` | On match | Yes | `block` | `block` or `delete` |
| `maxFrames` | Maximum sampled frames | Yes | `5` | 1–10; 1 checks only the first frame |
| `maxContentMiB` | Content size limit, MiB | Yes | `20` | Advanced, 1–100 |
| `timeoutMs` | Timeout, ms | Yes | `30000` | Advanced, 1000–120000 |

## Behavior and limitations

Any selected category reaching the threshold in any sampled frame is a match. Scores are not added together. The threshold is not an accuracy guarantee; adjust it based on false positives and missed detections. Enabling `Sexy` may also match swimwear or portrait photography. A passing result from this plugin never reverses an existing block or delete decision. See the [post-save pipeline guide (中文)](https://llleixx.github.io/picloom/guide/pipelines.html) for public access timing, cumulative dispositions and when configuration changes take effect.

Static images are reviewed once. Multi-frame images, such as GIF and animated WebP, are sampled evenly by frame index, including the first and last frames. Images with fewer frames than the limit are reviewed in full. For example, 21 frames with a limit of 5 selects frames 1, 6, 11, 16 and 21. Frame duration does not affect selection; unsampled frames are not reviewed. More samples require more CPU time.

Format support depends on the host's Sharp decoder. Each frame is limited to 40 million pixels. Orientation is corrected, transparency flattened onto white, and pixels converted to 224×224 sRGB for inference; stored originals remain unchanged. SVG review covers only the static image.

The summary records the model, categories, threshold, maximum scores per category, matched categories, total frames and sampled frame count. Maxima may come from different frames; `Drawing` and `Neutral` are informational and do not trigger decisions.

Oversized files, unsupported formats, decoding or model loading failures, invalid output and timeouts record task errors. They neither pass moderation nor automatically block access or retry. Unexpected worker exits and storage read errors retain the host's retry rules; after resolving the cause, use the task retry action.

Each instance reviews images serially and reuses its model, loading it on first execution. Timeout covers model loading, reading, decoding and inference, excluding queue time. File deletion or instance disposal cancels the associated execution; later executions can load a fresh model.

## Development

Shared commands are in the [repository development guide](../../README.md#development). This plugin's type checks, tests and builds first generate `.generated/worker.ts`, embedding CPU inference code and MobileNetV2 in the ZIP. Generated files are not committed; installation needs no additional npm dependencies.

After building, run `bun scripts/verify-package.ts` in this directory to verify independent ZIP loading, offline inference and resource release, and report timing, memory and package sizes. Set `PICLOOM_SOURCE_DIR` to also verify installation and post-save pipelines in a temporary host without accessing preview data. Simulated scores test decisions; real-model tests check the runtime path. Neither establishes detection accuracy.

The model comes from [NSFWJS](https://github.com/infinitered/nsfwjs), with inference provided by [TensorFlow.js](https://github.com/tensorflow/tfjs). The artifact's `thirdPartyNotices` export includes dependency licenses. `licenses/` retains Apache 2.0 text and the TensorFlow.js Layers dual license absent from the npm packages; the latter comes from the corresponding upstream version.
