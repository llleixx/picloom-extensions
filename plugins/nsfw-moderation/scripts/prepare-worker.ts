import { mkdir, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isBuiltin } from "node:module";
import { join, resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const result = await Bun.build({
  entrypoints: [root + "src/worker.ts"],
  target: "bun",
  format: "esm",
  minify: true,
  metafile: true,
  // TFJS registers CPU kernels and its platform through module side effects.
  ignoreDCEAnnotations: true,
  plugins: [
    {
      name: "cpu-only",
      setup(builder) {
        builder.onResolve(
          { filter: /^@tensorflow\/tfjs-backend-webgl$/ },
          () => ({ path: "webgl", namespace: "disabled" }),
        );
        builder.onLoad({ filter: /.*/, namespace: "disabled" }, () => ({
          contents: 'export const version_webgl = "disabled";',
          loader: "js",
        }));
      },
    },
  ],
});
if (!result.success) throw new Error(result.logs.join("\n"));
if (result.outputs.length !== 1)
  throw new Error("Worker must be self-contained");
const code = await result.outputs[0]!.text();
if (
  new Bun.Transpiler({ loader: "js" })
    .scanImports(code)
    .some((entry) => !isBuiltin(entry.path))
)
  throw new Error("Worker contains unbundled imports");
await mkdir(root + ".generated", { recursive: true });
// Include complete dependency notices in the single-entry artifact as an export.
// Use actual build inputs, including dependencies under Bun's isolated linker.
const notices: string[] = [];
const seen = new Set<string>();
async function collect(directory: string) {
  const pkg = await Bun.file(join(directory, "package.json")).json();
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) return;
  seen.add(key);
  const files = (await readdir(directory))
    .filter((file) => /^(licen[cs]e|notice|copying)(\.|$)/i.test(file))
    .sort();
  let texts = await Promise.all(
    files.map((file) => readFile(join(directory!, file), "utf8")),
  );
  if (!texts.length && pkg.license === "Apache-2.0")
    texts = [await readFile(root + "licenses/Apache-2.0.txt", "utf8")];
  if (!texts.length && pkg.name === "@tensorflow/tfjs-layers")
    texts = [await readFile(root + "licenses/tfjs-layers-LICENSE", "utf8")];
  if (!texts.length && pkg.name === "seedrandom") {
    const sources = [
      "seedrandom.js",
      ...(await readdir(join(directory, "lib")))
        .filter((file) => file.endsWith(".js") && !file.endsWith(".min.js"))
        .map((file) => "lib/" + file),
    ];
    for (const file of sources) {
      const source = await readFile(join(directory, file), "utf8");
      texts.push(
        ...(source.match(/\/\*[\s\S]*?\*\//g) ?? []).filter((comment) =>
          /copyright|license/i.test(comment),
        ),
      );
    }
  }
  if (!texts.length) throw new Error(`Missing license text: ${key}`);
  notices.push(`${key}\n${texts.join("\n")}`);
}
for (const input of Object.keys(result.metafile!.inputs).sort()) {
  const marker = input.lastIndexOf("node_modules/");
  if (marker === -1) continue;
  const base = input.slice(0, marker + "node_modules/".length);
  const parts = input.slice(base.length).split("/");
  const name = parts.slice(0, parts[0]!.startsWith("@") ? 2 : 1).join("/");
  await collect(resolve(base, name));
}
await Bun.write(
  root + ".generated/worker.ts",
  `export default ${JSON.stringify(code)};\nexport const thirdPartyNotices = ${JSON.stringify(notices.join("\n\n"))};\n`,
);
console.log(
  `NSFW worker: ${(Buffer.byteLength(code) / 1024 ** 2).toFixed(2)} MiB`,
);
