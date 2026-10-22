import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  publicDir: false,
  define:
    command === "build"
      ? { "process.env.NODE_ENV": JSON.stringify("production") }
      : {},
  build: {
    outDir: "dist/package",
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: resolve("src/entry.ts"),
      formats: ["es"],
      fileName: () => "entry.js",
      cssFileName: "style",
    },
  },
}));
