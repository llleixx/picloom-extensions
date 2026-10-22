import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extensions as paths } from "./workspaces";
const tag = process.env.RELEASE_TAG;
if (!tag || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(tag))
  throw Error("Set a new safe RELEASE_TAG");
async function gh(...args: string[]) {
  const p = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
  const output = await new Response(p.stdout).text();
  if (await p.exited)
    throw Error(
      "GitHub operation failed: " + (await new Response(p.stderr).text()),
    );
  return output;
}
const repo = JSON.parse(
  await gh("repo", "view", "--json", "nameWithOwner"),
).nameWithOwner;
const pages = JSON.parse(
  await gh(
    "api",
    "--paginate",
    "--slurp",
    `repos/${repo}/releases?per_page=100`,
  ),
).flat();
if (pages.some((r: any) => r.tag_name === tag))
  throw Error("Release already exists");
const tags = JSON.parse(
  await gh("api", "--paginate", "--slurp", `repos/${repo}/tags?per_page=100`),
).flat();
if (tags.some((t: any) => t.name === tag)) throw Error("Tag already exists");
const all = await Bun.file("dist/packages.json").json();
const requested = process.env.EXTENSIONS?.trim();
const selection = requested ? requested.split(/\s+/) : paths;
if (
  !selection.length ||
  selection.some((p) => !paths.includes(p)) ||
  new Set(selection).size !== selection.length
)
  throw Error("Invalid extension selection");
const selected = [];
for (const path of selection) {
  const m = await Bun.file(
    `${path}/${path.startsWith("plugins/") ? "plugin" : "theme"}.json`,
  ).json();
  const pkg = all.find((p: any) => p.id === m.id && p.version === m.version);
  if (!pkg) throw Error("Missing verified artifact");
  selected.push(pkg);
}
const sums = [];
const expected = await readFile("dist/SHA256SUMS", "utf8");
for (const p of selected) {
  if (pages.some((r: any) => r.assets.some((a: any) => a.name === p.artifact)))
    throw Error("Extension identity already released: " + p.artifact);
  const hash = createHash("sha256")
    .update(await readFile("dist/" + p.artifact))
    .digest("hex");
  const line = hash + "  " + p.artifact;
  if (!expected.split("\n").includes(line))
    throw Error("Checksum mismatch: " + p.artifact);
  sums.push(line);
}
const notes =
  "Maintained for the latest Picloom. CI runs independent type checks, unit tests and builds.\n\n" +
  selected
    .map(
      (p: any) => `- ${p.id} ${p.version}: API ${p.apiVersion}, SDK ${p.sdk}`,
    )
    .join("\n") +
  "\n\nProvider live tests require separate credentials and are not run by CI.\n";
await writeFile("dist/RELEASE.md", notes);
await writeFile("dist/SHA256SUMS", sums.join("\n") + "\n");
await Bun.write("dist/packages.json", JSON.stringify(selected, null, 2) + "\n");
const commit = (
  await gh(
    "api",
    `repos/${repo}/commits/${process.env.GITHUB_SHA ?? "HEAD"}`,
    "--jq",
    ".sha",
  )
).trim();
await gh(
  "release",
  "create",
  tag,
  "--draft",
  "--target",
  commit,
  "--title",
  tag,
  "--notes-file",
  "dist/RELEASE.md",
  ...selected.map((p: any) => "dist/" + p.artifact),
  "dist/SHA256SUMS",
  "dist/packages.json",
);
console.log("Draft Release prepared");
