import { extensions } from "./workspaces";
for (const directory of extensions) {
  const p = Bun.spawn(["bun", "run", "typecheck"], {
    cwd: directory,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (await p.exited) process.exit(1);
}
