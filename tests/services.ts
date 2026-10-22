import sharp from "sharp";
import type {
  Config,
  InstanceServices,
  PipelineData,
  Json,
} from "@picloom/plugin-sdk";
export function services(secrets: Config): InstanceServices {
  let state: Config = {},
    version = 1;
  return {
    images: { sharp },
    log() {},
    async readSecrets() {
      return { value: secrets, version: 1 };
    },
    async updateSecrets() {
      throw Error("Unexpected secret update");
    },
    async readState() {
      return { value: state, version };
    },
    async updateState(value, expected) {
      if (expected !== version) throw Error("State conflict");
      state = value;
      version++;
    },
  };
}
export const image = () =>
  sharp({
    create: {
      width: 40,
      height: 20,
      channels: 4,
      background: { r: 20, g: 100, b: 180, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
export function pipelineData(): PipelineData {
  const values = new Map<string, Json>();
  return {
    get: (key: string) => values.get(key),
    set: (key: string, value: Json) => {
      values.set(key, value);
    },
  };
}
