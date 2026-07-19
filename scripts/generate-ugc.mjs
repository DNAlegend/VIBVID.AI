// Render the UGC style library for real: every style in src/lib/ugc-templates.ts
// becomes a genuine 15-second Seedance 2.0 vertical clip (native audio, the
// style's demo product steering as a reference image), downloaded into
// public/generated/ and registered in src/lib/generated.json.
//
//   node --experimental-strip-types scripts/generate-ugc.mjs            (all)
//   node --experimental-strip-types scripts/generate-ugc.mjs --only ugc-car-review
//
// Product reference images are the deployed site's own renders
// (https://vibvid.ai/generated/<id>.jpg) — public URLs Ark can fetch.

import { mkdir, readFile, writeFile } from "node:fs/promises";

const KEY = process.env.ARK_API_KEY ?? (await envLocal("ARK_API_KEY"));
if (!KEY) {
  console.error("ARK_API_KEY missing (env or .env.local)");
  process.exit(1);
}
const BASE = "https://ark.ap-southeast.bytepluses.com/api/v3";
const HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` };
const MODEL = process.env.UGC_VIDEO_MODEL ?? "dreamina-seedance-2-0-260128";
const RES = process.env.UGC_VIDEO_RES ?? "720p";
const REF_BASE = "https://vibvid.ai/generated";
const OUT_DIR = new URL("../public/generated/", import.meta.url);
const MANIFEST = new URL("../src/lib/generated.json", import.meta.url);

async function envLocal(name) {
  try {
    const raw = await readFile(new URL("../.env.local", import.meta.url), "utf8");
    const line = raw.split("\n").find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : null;
  } catch {
    return null;
  }
}

const { UGC_STYLES } = await import("../src/lib/ugc-templates.ts");

const argv = process.argv.slice(2);
const onlyArg = argv.indexOf("--only");
const only = onlyArg >= 0 ? new Set(argv[onlyArg + 1].split(",")) : null;
const styles = UGC_STYLES.filter((s) => !only || only.has(s.id));

async function saveManifest(patch) {
  let current = {};
  try { current = JSON.parse(await readFile(MANIFEST, "utf8")); } catch {}
  await writeFile(MANIFEST, JSON.stringify({ ...current, ...patch }, null, 2) + "\n");
}

async function submit(style) {
  const legend = `Image 1 shows the product "${style.demo.product}" — reproduce this exact product, its shape, colors, materials and label, whenever it is on screen; do not redesign it.`;
  const text = `${legend}\n\n${style.script(style.demo)} --resolution ${RES} --duration ${style.durationSec} --ratio 9:16 --watermark false`;
  const res = await fetch(`${BASE}/contents/generations/tasks`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      model: MODEL,
      generate_audio: true,
      content: [
        { type: "text", text },
        { type: "image_url", image_url: { url: `${REF_BASE}/${style.demoRefId}.jpg` }, role: "reference_image" },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${style.id}: submit HTTP ${res.status} ${await res.text()}`);
  const { id } = await res.json();
  if (!id) throw new Error(`${style.id}: no task id`);
  return id;
}

async function await_(style, taskId) {
  const deadline = Date.now() + 20 * 60 * 1000;
  for (;;) {
    await new Promise((r) => setTimeout(r, 8000));
    const poll = await fetch(`${BASE}/contents/generations/tasks/${taskId}`, { headers: HEADERS });
    if (!poll.ok) throw new Error(`${style.id}: poll HTTP ${poll.status}`);
    const task = await poll.json();
    if (task.status === "succeeded") {
      const url = task.content?.video_url;
      if (!url) throw new Error(`${style.id}: succeeded but no video_url`);
      const dl = await fetch(url);
      if (!dl.ok) throw new Error(`${style.id}: download HTTP ${dl.status}`);
      await writeFile(new URL(`${style.id}.mp4`, OUT_DIR), Buffer.from(await dl.arrayBuffer()));
      await saveManifest({ [style.id]: `/generated/${style.id}.mp4` });
      return;
    }
    if (task.status === "failed" || task.status === "cancelled") {
      throw new Error(`${style.id}: ${task.status} — ${JSON.stringify(task.error ?? task).slice(0, 300)}`);
    }
    if (Date.now() > deadline) throw new Error(`${style.id}: timed out (task ${taskId})`);
  }
}

await mkdir(OUT_DIR, { recursive: true });
const failures = [];
// Waves of 3 — individual Ark accounts cap concurrency at 3 for non-4K.
for (let i = 0; i < styles.length; i += 3) {
  const wave = styles.slice(i, i + 3);
  await Promise.all(
    wave.map(async (style) => {
      try {
        console.log(`submit ${style.id}…`);
        const taskId = await submit(style);
        await await_(style, taskId);
        console.log(`done   ${style.id}`);
      } catch (e) {
        console.error(`FAIL   ${e instanceof Error ? e.message : e}`);
        failures.push(style.id);
      }
    }),
  );
}
console.log(failures.length ? `finished with failures: ${failures.join(", ")}` : "all UGC styles rendered.");
process.exit(failures.length ? 1 : 0);
