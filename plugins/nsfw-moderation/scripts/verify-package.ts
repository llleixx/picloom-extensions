import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { strict as assert } from "node:assert";
import { settings } from "../tests/helpers";
import manifest from "../plugin.json";

const root = fileURLToPath(new URL("../", import.meta.url));
const bytes = await Bun.file(
  join(root, "dist", `${manifest.id}-${manifest.version}.zip`),
).bytes();
const entries = unzipSync(bytes);
assert.deepEqual(Object.keys(entries).sort(), ["index.js", "plugin.json"]);
const directory = await mkdtemp(join(tmpdir(), "picloom-nsfw-package-"));
try {
  for (const name of ["index.js", "plugin.json"])
    await writeFile(join(directory, name), entries[name]!);
  const sharpUrl = pathToFileURL(
    createRequire(import.meta.url).resolve("sharp"),
  ).href;
  // Run outside the repository: only the host's Sharp is supplied to the plugin.
  // No installed npm dependencies are available relative to the unpacked entry.
  await writeFile(
    join(directory, "verify.ts"),
    `
import { strict as assert } from "node:assert";
import sharp from ${JSON.stringify(sharpUrl)};
import definition, { thirdPartyNotices } from "./index.js";
const tensorCounts = [];
const NativeWorker = globalThis.Worker;
globalThis.Worker = class extends NativeWorker {
  constructor(url, options) {
    super(url, options);
    this.addEventListener("message", ({data}) => {
      if (data.type === "result") tensorCounts.push(data.tensorCount);
    });
  }
};
globalThis.fetch = () => { throw Error("Network disabled by package verification"); };
assert(thirdPartyNotices.includes("Permission is hereby granted"));
assert(thirdPartyNotices.includes("Apache License"));
const config = ${JSON.stringify(settings)};
const png = await sharp({create:{width:40,height:20,channels:3,background:"#808080"}}).png().toBuffer();
const file = {metadata:{mimeType:"image/png",byteSize:png.length,width:40,height:20},async openRead(){return new Blob([png]).stream()}};
const input = {operationId:"verification:step",record:{id:"file",createdAt:1,origin:{kind:"upload",userId:null},ownerId:null,organization:{tags:[],collections:[]}},url:"/image.png",publicPath:"/image.png",currentDisposition:"pass",previousResults:[],file};
const context = {signal:new AbortController().signal,requestId:"verification",data:{get(){},set(){}},log(){},organization:{}};
const runtime = await definition.stages.post_save.createInstance({id:"verification",config,services:{images:{sharp}}});
let ticks=0;
const timer=setInterval(()=>ticks++,10);
const elapsed=[];
const rss=[];
try {
  for(let i=0;i<12;i++) {
    const start=performance.now();
    const result=await runtime.execute(input,context);
    elapsed.push(Math.round(performance.now()-start));
    rss.push(Math.round(process.memoryUsage().rss/1024**2));
    assert.equal(result.disposition.value,"pass");
    assert.equal(result.details.sampledFrames,1);
  }
  assert.equal(tensorCounts.length,12);
  assert.equal(new Set(tensorCounts).size,1,"Tensors leaked between calls");
  assert(ticks>20,"Main thread stalled during inference");
  console.log(JSON.stringify({firstCallMs:elapsed[0],warmCallMs:elapsed.slice(1),rssMiB:rss,tensorCounts,mainThreadTicks:ticks}));
} finally { clearInterval(timer); await runtime.dispose(); }
// A new runtime must load its own usable model after disposal.
const next=await definition.stages.post_save.createInstance({id:"replacement",config,services:{images:{sharp}}});
try {assert.equal((await next.execute(input,context)).disposition.value,"pass");} finally {await next.dispose();}
`,
  );
  const child = Bun.spawn(
    [process.execPath, "--no-install", join(directory, "verify.ts")],
    {
      cwd: directory,
      env: { ...process.env, NODE_PATH: "" },
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  assert.equal(await child.exited, 0, "Standalone package verification failed");
  console.log(
    JSON.stringify({
      zipMiB: bytes.length / 1024 ** 2,
      expandedMiB:
        Object.values(entries).reduce((sum, value) => sum + value.length, 0) /
        1024 ** 2,
    }),
  );

  if (process.env.PICLOOM_SOURCE_DIR) {
    // The host fixture always creates a temporary database and storage directory.
    process.env.TEST_FIXTURE_POSTGRES_URL = "";
    const { fixture } = await import(
      pathToFileURL(resolve(process.env.PICLOOM_SOURCE_DIR, "tests/helpers.ts"))
        .href
    );
    const host = await fixture();
    try {
      const form = new FormData();
      form.set("file", new File([bytes], "nsfw.zip"));
      const inspection = await host.request(
        "/api/plugins/inspect",
        "POST",
        form,
      );
      assert.equal(inspection.status, 200, await inspection.clone().text());
      const installed = await host.request("/api/plugins/install", "POST", {
        ticket: (await inspection.json()).ticket,
        confirmTrusted: true,
      });
      assert.equal(installed.status, 201, await installed.clone().text());
      assert.equal((await installed.json()).status, "loaded");
      for (const [name, config, status] of [
        ["pass", settings, "ready"],
        ["block", { ...settings, threshold: 0.0000001 }, "blocked"],
        [
          "delete",
          { ...settings, threshold: 0.0000001, blockAction: "delete" },
          "deleted",
        ],
      ] as const) {
        const chain = await host.app.configuration.savePipeline({
          name: "NSFW package " + name,
          kind: "post_save",
          steps: [{ pluginId: manifest.id, version: manifest.version, config }],
        });
        const profile = await host.app.configuration.profileEditor(
          host.profileId,
        );
        await host.app.configuration.saveProfileEditor(
          {
            ...profile,
            expectedVersion: profile.configVersion,
            postSavePipelineId: chain.id,
          },
          profile.id,
        );
        const response = await host.upload();
        assert.equal(response.status, 201, await response.clone().text());
        const uploaded = await response.json();
        await host.app.files.sweep();
        const record = await host.app.db.read((r: any) => r.file(uploaded.id));
        assert.equal(record.status, status);
        const tasks = await host.app.db.read((r: any) => r.tasks(uploaded.id));
        assert.equal(
          tasks.find((task: any) => task.kind === "action").status,
          "success",
        );
      }
      console.log(
        "Isolated host installation and pass/block/delete pipelines passed",
      );
    } finally {
      await host.close();
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
