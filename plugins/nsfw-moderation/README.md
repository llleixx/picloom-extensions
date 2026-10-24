# Local NSFW Moderation

**English** · [简体中文](README.zh-CN.md)

Review saved images for pornography, pornographic illustrations and optional suggestive content using the bundled NSFWJS MobileNetV2 model. Inference runs on the Picloom server's CPU without a GPU, external service or credentials. Runtime inference neither downloads models nor sends images to third parties.

`picloom.nsfw-moderation` · `processor` · `post_save`

## Install and use

Upload the plugin ZIP in plugin management, create a configuration, and add it to the post-save pipeline used by your upload profile. Place notification plugins, such as Telegram Notification, after this step. Review results in the image details. Matches block access by default; deletion is optional.

| Setting                            | Default          | Values                                                                                                    |
| ---------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| Categories `categories`            | `Porn`, `Hentai` | Pornography and pornographic illustrations; optionally `Sexy` for suggestive content; select at least one |
| Threshold `threshold`              | `0.8`            | Greater than 0 and at most 1, shared by selected categories                                               |
| On match `blockAction`             | `block`          | `block` or `delete`                                                                                       |
| Maximum sampled frames `maxFrames` | `5`              | 1–10; 1 checks only the first frame                                                                       |
| Content size limit `maxContentMiB` | `20`             | Advanced, 1–100 MiB                                                                                       |
| Timeout `timeoutMs`                | `30000`          | Advanced, 1000–120000 milliseconds                                                                        |

A match occurs when any selected category reaches the threshold in any reviewed frame. Scores from different categories are not added together. The default threshold is a starting configuration, not an accuracy guarantee; adjust it based on false positives and missed detections in your images. `Sexy` is off by default; enabling it may also match swimwear or portrait photography.

This is post-save moderation: images may already be accessible before review completes. A passing result never reverses an existing block or delete decision. Installing the plugin or changing configuration does not automatically review previously completed images.

## Images and results

The plugin uses Picloom's Sharp to decode JPEG, PNG, WebP, GIF, AVIF, TIFF and SVG; actual decoding support depends on the host. The per-frame limit is 40 million pixels. Before inference, orientation is corrected, transparency is flattened onto white, and pixels are converted to a 224×224 sRGB image. Stored originals remain unchanged. SVG review covers only the static rasterized image.

Multi-frame images are sampled evenly by frame index, including the first and last frames. Images with fewer frames than the limit are reviewed in full. For example, 21 frames with a limit of 5 selects frames 1, 6, 11, 16 and 21. Frame duration does not affect selection, and unsampled frames are not reviewed. More samples require more CPU time.

The summary contains the model, selected categories, threshold, maximum scores per category, matched categories, total frames and sampled frame count. Maxima may come from different frames and are not a single probability distribution. `Drawing` and `Neutral` are shown for context and do not trigger moderation decisions.

Oversized files, decoding failures, model loading failures, invalid output and timeouts record a task error. They are neither passing reviews nor automatic blocks, and are not automatically retried. Unexpected worker exits allow retries under the host's task rules; storage read errors retain the host's retry behavior. After resolving the cause, use the existing task retry action.

Each runtime instance reviews files serially and reuses its model, loading it on the first execution. Timeout starts after acquiring an execution slot and includes model loading, file reading, decoding and inference; queue time is excluded. File deletion or instance disposal cancels the associated execution. Later executions can load a fresh model.

## Development

Use the repository's Bun version. Install dependencies from the repository root, then run in this directory:

```sh
bun run typecheck
bun run test
bun run build
```

These commands first generate `.generated/worker.ts`, embedding CPU inference code and only the MobileNetV2 model, then use the shared plugin tooling to package the plugin. The ZIP installs independently without npm dependencies on the destination server. Generated files are not committed.

Tests cover decisions with simulated scores, real GIF/WebP sampling, cancellation and failure handling, and the actual model with networking disabled. They do not establish detection accuracy. Run `bun scripts/verify-package.ts` to check an already-built ZIP's independent loading, offline inference and resource release, and report local timing, memory and package sizes. With `PICLOOM_SOURCE_DIR` set, it also installs the plugin and runs the post-save pipeline using that source tree's isolated test environment, without accessing preview data.

The model comes from [NSFWJS](https://github.com/infinitered/nsfwjs), with inference provided by [TensorFlow.js](https://github.com/tensorflow/tfjs). The artifact's `thirdPartyNotices` export includes dependency licenses. `licenses/` retains Apache 2.0 text and the TensorFlow.js Layers dual license absent from the npm packages; the latter comes from the corresponding upstream version.
