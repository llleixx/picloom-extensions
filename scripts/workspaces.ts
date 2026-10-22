import { workspaces } from "../package.json";

export const extensions: string[] = [];
for (const pattern of workspaces) {
  for await (const path of new Bun.Glob(`${pattern}/package.json`).scan({ onlyFiles: true })) {
    extensions.push(path.slice(0, -"/package.json".length));
  }
}
extensions.sort();
