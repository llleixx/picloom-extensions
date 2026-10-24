import * as tf from "@tensorflow/tfjs";
import { load } from "nsfwjs/core";
import { MobileNetV2Model } from "nsfwjs/models/mobilenet_v2";

declare const self: Worker;
// The worker has no network input: both topology and weights are bundled.
let model: Awaited<ReturnType<typeof load>>;
self.onmessage = async ({ data }: MessageEvent<Uint8Array>) => {
  let input: tf.Tensor3D | undefined;
  try {
    input = tf.tensor3d(data, [224, 224, 3], "int32");
    const predictions = await model.classify(input, 5);
    input.dispose();
    input = undefined;
    self.postMessage({
      type: "result",
      predictions,
      tensorCount: tf.memory().numTensors,
    });
  } catch {
    self.postMessage({ type: "error", phase: "inference" });
  } finally {
    input?.dispose();
  }
};
try {
  tf.enableProdMode();
  await tf.setBackend("cpu");
  await tf.ready();
  model = await load("MobileNetV2", { modelDefinitions: [MobileNetV2Model] });
  self.postMessage({ type: "ready" });
} catch {
  self.postMessage({ type: "error", phase: "load" });
}
