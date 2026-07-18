// Generate ALL the site's demo media with real ByteDance models via the
// BytePlus ModelArk API: showcase images (Seedream) + hero/UGC demo videos
// (Seedance). Downloads land in public/generated/ and src/lib/generated.json
// is updated so the landing page picks them up automatically.
//
// Setup:
//   1. .env.local:  ARK_API_KEY=...   (models must be Activated in the
//      Ark console: seedream-4-0-250828 and seedance-1-0-pro-250528)
//   2. Run:  npm run generate:demo            (everything)
//            npm run generate:demo -- --images    (images only)
//            npm run generate:demo -- --videos    (videos only)
//
// Ark video results are temporary URLs (~24h) — this script downloads them
// immediately, which is why the site only ever references local files.

import { writeFile, mkdir, readFile, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);

/* ------------------------------- env ------------------------------------ */

try {
  const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const KEY = process.env.ARK_API_KEY;
const BASE = process.env.ARK_BASE_URL ?? "https://ark.ap-southeast.bytepluses.com/api/v3";
const IMAGE_MODEL = process.env.ARK_IMAGE_MODEL ?? "seedream-4-0-250828";
const VIDEO_MODEL = process.env.ARK_VIDEO_MODEL ?? "dreamina-seedance-2-0-260128";
const VIDEO_RES = process.env.ARK_VIDEO_RESOLUTION ?? "720p"; // keep site files lean

if (!KEY) {
  console.error("Missing ARK_API_KEY — add it to .env.local first.");
  process.exit(1);
}

const HEADERS = { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` };
const OUT_DIR = new URL("../public/generated/", import.meta.url);
const MANIFEST = new URL("../src/lib/generated.json", import.meta.url);

const argv = process.argv.slice(2);
const studioOnly = argv.includes("--studio");
const doImages = !studioOnly && !argv.includes("--videos");
const doVideos = !studioOnly && !argv.includes("--images");
const doStudio = studioOnly || argv.includes("--all");
// --only id1,id2 renders JUST those ids (images & videos filtered alike) —
// without it a --videos run re-renders EVERY demo, burning real Ark spend.
const onlyArg = argv.find((a) => a.startsWith("--only"));
const onlyIds = onlyArg
  ? (onlyArg.includes("=") ? onlyArg.split("=")[1] : argv[argv.indexOf(onlyArg) + 1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;
const wanted = (id) => !onlyIds || onlyIds.includes(id);

/* ------------------------------ content --------------------------------- */

const STYLE =
  "cinematic film still, dramatic lighting, rich color grading, shallow depth of field, photorealistic, 35mm film grain";

// Landing showcase images — ids match the /art/<id>.svg placeholders.
const IMAGES = [
  { id: "hero-neon-city", size: "1280x720", prompt: `Lone samurai in neon-trimmed armor walking through a rain-soaked Tokyo street canyon at night, glowing pink and cyan signs reflecting in puddles, volumetric haze, ${STYLE}` },
  { id: "art-product-reveal", size: "1280x720", prompt: `Luxury perfume bottle on a dark pedestal under a single warm spotlight, floating dust particles, purple and teal accent glow, studio product photography, ${STYLE}` },
  { id: "art-neon-tokyo", size: "1024x1024", prompt: `Neon Tokyo skyline at night over a still river, giant pink moon, glowing signs mirrored in the water, ${STYLE}` },
  { id: "art-cyber-detective", size: "1024x1024", prompt: `Trench-coat detective silhouetted in a warmly lit doorway of a rainy cyberpunk alley, pink neon sign on brick wall, fog rolling on the ground, ${STYLE}` },
  { id: "art-forest-spirit", size: "1024x1024", prompt: `Glowing spectral deer with luminous antlers standing in a dark misty forest, god rays through the canopy, fireflies drifting, ${STYLE}` },
  { id: "art-ballet", size: "1024x1024", prompt: `Ballerina in arabesque silhouetted under a single stage spotlight, red velvet curtains, dust motes in the light beam, ${STYLE}` },
  { id: "art-desert-run", size: "1280x720", prompt: `Runner on a dune ridge at sunset, giant golden sun on the horizon, drifting sand, purple and orange sky, ${STYLE}` },
  { id: "art-underwater-city", size: "1024x1024", prompt: `Futuristic underwater city inside glass domes on the ocean floor, light rays from the surface, schools of fish and rising bubbles, ${STYLE}` },
  { id: "art-astro-mars", size: "1024x1024", prompt: `Astronaut floating above a glowing Mars colony dome at night, ringed planet and stars in the sky, tether drifting, ${STYLE}` },
  { id: "art-cloud-temple", size: "1024x1024", prompt: `Red torii gate and shrine on a floating island above a sea of clouds at sunset, golden sun behind, distant birds, ${STYLE}` },
  { id: "art-evening-gown", size: "1024x1024", prompt: `Elegant magenta silk evening gown on a dress form under a single spotlight in a dark atelier, sparkling fabric, glossy floor reflection, ${STYLE}` },
];

// Starter-library thumbnails (run with --studio) — one per catalog asset,
// ids match src/lib/catalog.ts so thumbFor() picks them up via the manifest.
const CHAR = (s) => `cinematic character portrait, waist-up, facing camera, ${s}, soft studio key light, dark neutral backdrop, photorealistic, rich color grading`;
const GARM = (s) => `high-end fashion product shot of ${s} on an invisible mannequin, seamless dark studio backdrop, dramatic soft lighting, photorealistic`;
const SCENE = (s) => `cinematic establishing shot of ${s}, dramatic lighting, rich color grading, photorealistic, 35mm film still`;
const DANCE = (s) => `dynamic photo of a dancer mid-move performing ${s}, dramatic rim lighting, dark studio backdrop, slight motion blur on limbs, photorealistic`;
const PROD = (s) => `premium e-commerce product photograph of ${s}, seamless light-gray backdrop, soft studio shadows, crisp detail, photorealistic`;
const COVER = (s) => `abstract album cover art evoking ${s}, bold shapes, rich colors, no text, no letters`;

const STUDIO = [
  ["cast-astronaut", CHAR("a lone astronaut in a detailed spacesuit, helmet under one arm")],
  ["cast-neon-samurai", CHAR("a neon-lit samurai warrior in dark lacquered armor with glowing pink and cyan trim")],
  ["cast-cyber-detective", CHAR("a cyberpunk detective in a rain-flecked trench coat and fedora")],
  ["cast-forest-spirit", CHAR("an ethereal glowing forest spirit with luminous skin and leaf-woven hair")],
  ["cast-deep-sea-diver", CHAR("a deep-sea diver in a vintage brass diving suit, helmet under one arm")],
  ["cast-desert-nomad", CHAR("a desert nomad in weathered layered robes and a head wrap, golden-hour light")],
  ["dress-evening-gown", GARM("an elegant flowing crimson silk evening gown")],
  ["dress-streetwear", GARM("a relaxed urban streetwear outfit with an oversized hoodie and cargo pants")],
  ["dress-kimono", GARM("a traditional silk kimono with orange and gold crane embroidery")],
  ["dress-cyber-armor", GARM("sleek futuristic cyber armor with glowing cyan seams")],
  ["dress-royal-robe", GARM("an ornate royal robe in deep purple velvet with gold embroidery")],
  ["dress-tuxedo", GARM("a sharp midnight-navy tailored tuxedo")],
  ["set-neon-tokyo", SCENE("a rain-soaked neon Tokyo street at night, glowing signs reflecting in puddles")],
  ["set-mars-colony", SCENE("a futuristic Mars colony of glass domes at dawn, red dunes")],
  ["set-enchanted-forest", SCENE("a misty enchanted forest with glowing spores drifting between mossy trees")],
  ["set-underwater-city", SCENE("a glowing bioluminescent underwater city on the ocean floor")],
  ["set-desert-highway", SCENE("an endless desert highway at golden hour, heat shimmer")],
  ["set-cloud-temple", SCENE("an ancient temple floating on an island above a sea of clouds at sunset")],
  ["dance-hiphop", DANCE("an energetic hip-hop street dance freeze")],
  ["dance-ballet", DANCE("a graceful ballet arabesque in a flowing dress")],
  ["dance-breakdance", DANCE("an explosive breakdance power move, inverted on one hand")],
  ["dance-salsa", DANCE("a passionate salsa dip in a red dress")],
  ["dance-robot", DANCE("a precise robotic pop-and-lock pose in futuristic clothing")],
  ["dance-contemporary", DANCE("a fluid contemporary dance leap with fabric trailing")],
  ["prod-serum", PROD("a frosted glass skincare serum bottle with a dropper cap")],
  ["prod-sneakers", PROD("a pair of limited-edition white and orange sneakers")],
  ["prod-earbuds", PROD("matte-black wireless earbuds in an open charging case")],
  ["prod-watch", PROD("a minimalist steel wristwatch with a sapphire-blue dial")],
  ["prod-handbag", PROD("a structured tan leather designer handbag")],
  ["prod-coffee", PROD("a matte-black craft coffee bag with copper accents")],
  ["score-orchestral", COVER("an epic sweeping orchestral score, brass and strings")],
  ["score-synthwave", COVER("retro synthwave, neon grid horizon and a setting sun")],
  ["score-lofi", COVER("warm chill lo-fi beats, cozy dusk tones")],
  ["score-strings", COVER("tense suspenseful strings, taut dark lines")],
  ["score-ambient", COVER("soft dreamy ambient pads, drifting pastel clouds")],
  ["score-drums", COVER("powerful tribal drums, bold earthen rhythm")],
].map(([id, prompt]) => ({ id, size: "1024x1024", prompt }));

// Videos: the hero clip + every use-case demo from demo-content.json.
const demoJson = JSON.parse(await readFile(new URL("../src/lib/demo-content.json", import.meta.url), "utf8"));
const VIDEOS = [
  {
    id: "hero-video",
    aspect: "16:9",
    prompt: "A neon samurai walks through rain-soaked Tokyo at night, neon signs reflecting in puddles, cinematic slow motion, volumetric haze",
  },
  ...demoJson.demos.map((d) => ({ id: d.id, aspect: d.aspect, prompt: d.prompt })),
];

/* ------------------------------ helpers --------------------------------- */

async function saveManifest(patch) {
  let current = {};
  try { current = JSON.parse(await readFile(MANIFEST, "utf8")); } catch {}
  await writeFile(MANIFEST, JSON.stringify({ ...current, ...patch }, null, 2) + "\n");
}

async function download(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${filename}: HTTP ${res.status}`);
  await writeFile(new URL(filename, OUT_DIR), Buffer.from(await res.arrayBuffer()));
}

// Seedream 4.5/5.0 render at 2K-class canvases only — upsize the request,
// then downscale locally so the site ships light files with the new model's
// detail baked in.
const IS_2K_MODEL = /seedream-(4-5|5)/.test(IMAGE_MODEL);
const SIZE_2K = { "1024x1024": "1920x1920", "1280x720": "2560x1440" };

async function generateImage({ id, size, prompt }) {
  const askSize = IS_2K_MODEL ? SIZE_2K[size] ?? size : size;
  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: askSize, response_format: "b64_json", watermark: false }),
  });
  if (!res.ok) throw new Error(`image ${id}: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`image ${id}: empty response ${JSON.stringify(json).slice(0, 200)}`);

  if (!IS_2K_MODEL) {
    await writeFile(new URL(`${id}.png`, OUT_DIR), Buffer.from(b64, "base64"));
    await saveManifest({ [id]: `/generated/${id}.png` });
    return;
  }
  // 2K intermediate → display-size JPEG via macOS sips (no extra deps).
  const tmp = new URL(`${id}.tmp.png`, OUT_DIR);
  const out = new URL(`${id}.jpg`, OUT_DIR);
  await writeFile(tmp, Buffer.from(b64, "base64"));
  const maxDim = size === "1024x1024" ? "1024" : "1280";
  await run("sips", ["-Z", maxDim, "-s", "format", "jpeg", "-s", "formatOptions", "88", fileURLToPath(tmp), "--out", fileURLToPath(out)]);
  await unlink(tmp);
  await saveManifest({ [id]: `/generated/${id}.jpg` });
}

async function generateVideo({ id, aspect, prompt }) {
  const text = `${prompt} --resolution ${VIDEO_RES} --duration 5 --ratio ${aspect} --watermark false`;
  const res = await fetch(`${BASE}/contents/generations/tasks`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ model: VIDEO_MODEL, content: [{ type: "text", text }] }),
  });
  if (!res.ok) throw new Error(`video ${id}: HTTP ${res.status} ${await res.text()}`);
  const { id: taskId } = await res.json();
  if (!taskId) throw new Error(`video ${id}: no task id`);

  // Poll until the render lands (typically 30–90s).
  const deadline = Date.now() + 8 * 60 * 1000;
  for (;;) {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await fetch(`${BASE}/contents/generations/tasks/${taskId}`, { headers: HEADERS });
    if (!poll.ok) throw new Error(`video ${id}: poll HTTP ${poll.status} ${await poll.text()}`);
    const task = await poll.json();
    if (task.status === "succeeded") {
      const url = task.content?.video_url;
      if (!url) throw new Error(`video ${id}: succeeded but no video_url`);
      await download(url, `${id}.mp4`);
      await saveManifest({ [id]: `/generated/${id}.mp4` });
      return;
    }
    if (task.status === "failed" || task.status === "cancelled") {
      throw new Error(`video ${id}: task ${task.status} — ${JSON.stringify(task.error ?? task).slice(0, 300)}`);
    }
    if (Date.now() > deadline) throw new Error(`video ${id}: timed out waiting for task ${taskId}`);
    process.stdout.write(".");
  }
}

/* -------------------------------- run ----------------------------------- */

await mkdir(OUT_DIR, { recursive: true });
const failures = [];

if (doImages) {
  for (const img of IMAGES.filter((i) => wanted(i.id))) {
    process.stdout.write(`image  ${img.id} … `);
    try { await generateImage(img); console.log("done"); }
    catch (e) { console.log("FAILED"); console.error(`  ${e.message}`); failures.push(img.id); }
  }
}

if (doStudio) {
  for (const img of STUDIO.filter((i) => wanted(i.id))) {
    process.stdout.write(`studio ${img.id} … `);
    try { await generateImage(img); console.log("done"); }
    catch (e) { console.log("FAILED"); console.error(`  ${e.message}`); failures.push(img.id); }
  }
}

if (doVideos) {
  for (const vid of VIDEOS.filter((v) => wanted(v.id))) {
    process.stdout.write(`video  ${vid.id} `);
    try { await generateVideo(vid); console.log(" done"); }
    catch (e) { console.log(" FAILED"); console.error(`  ${e.message}`); failures.push(vid.id); }
  }
}

console.log(failures.length
  ? `\nFinished with ${failures.length} failure(s): ${failures.join(", ")} — rerun to retry (manifest keeps successes).`
  : "\nAll media generated. The site now serves real model output from public/generated/.");
process.exit(failures.length ? 1 : 0);
