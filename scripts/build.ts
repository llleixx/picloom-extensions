import { mkdir, copyFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { extensions as available } from "./workspaces";
const selected = process.argv.slice(2).length
  ? process.argv.slice(2)
  : available;
if (
  !selected.length ||
  new Set(selected).size !== selected.length ||
  selected.some((p) => !available.includes(p))
)
  throw Error("Select unique extension paths: " + available.join(", "));
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
const sums: string[] = [];
const packages = [];
for (const path of selected) {
  const result = Bun.spawn(["bun", "run", "build"], {
    cwd: path,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (await result.exited) throw Error("Build failed: " + path);
  const manifest = await Bun.file(
    `${path}/${path.startsWith("plugins/") ? "plugin" : "theme"}.json`,
  ).json();
  const packageJson = await Bun.file(`${path}/package.json`).json();
  const sdkName = path.startsWith("plugins/")
    ? "@picloom/plugin-sdk"
    : "@picloom/theme-sdk";
  if (
    !packageJson.dependencies?.[sdkName] &&
    !packageJson.devDependencies?.[sdkName]
  )
    throw Error(`Missing SDK dependency: ${path}`);
  const require = createRequire(resolve(path, "package.json"));
  let sdk: string | undefined;
  for (const directory of require.resolve.paths(sdkName) ?? []) {
    const file = Bun.file(join(directory, sdkName, "package.json"));
    if (!(await file.exists())) continue;
    const installed = await file.json();
    if (installed.name !== sdkName || typeof installed.version !== "string")
      throw Error(`Invalid installed SDK package: ${path}`);
    sdk = installed.version;
    break;
  }
  if (!sdk) throw Error(`SDK is not installed: ${path}`);
  const name = `${manifest.id}-${manifest.version}.zip`;
  await copyFile(`${path}/dist/${name}`, `dist/${name}`);
  sums.push(
    createHash("sha256")
      .update(await Bun.file(`dist/${name}`).bytes())
      .digest("hex") +
      "  " +
      name,
  );
  packages.push({
    id: manifest.id,
    version: manifest.version,
    apiVersion: manifest.apiVersion,
    sdk,
    artifact: name,
  });
}
await Bun.write("dist/SHA256SUMS", sums.join("\n") + "\n");
await Bun.write("dist/packages.json", JSON.stringify(packages, null, 2) + "\n");
