// Generate the landing page's UGC presenter imagery with ChatGPT's image
// model (gpt-image-2): one character sheet for "Maya", then six stills of the
// SAME face in classic UGC ad settings — the sheet rides along as an identity
// reference on every scene, which is exactly the promise the section makes.
//
// Setup:  OPENAI_API_KEY in the environment or .env.local
// Run:    node scripts/generate-landing-ugc.mjs            (everything)
//         node scripts/generate-landing-ugc.mjs --only ugc-maya-kitchen
//
// Output: public/generated/<id>.jpg + entries in src/lib/generated.json.

import { writeFile, mkdir, readFile, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);

/* ------------------------------- env ------------------------------------ */

for (const file of ["../.env.local", "../.env.vercel.local"]) {
  try {
    const env = await readFile(new URL(file, import.meta.url), "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.+?)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error("Missing OPENAI_API_KEY — add it to .env.local first.");
  process.exit(1);
}
const BASE = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
const OUT_DIR = new URL("../public/generated/", import.meta.url);
const MANIFEST = new URL("../src/lib/generated.json", import.meta.url);

/* ------------------------------ content --------------------------------- */

// The shared person + camera language keeps every scene reading as the same
// creator filming herself. The sheet is also attached as a reference image.
const MAYA =
  "Maya, an original AI-generated woman in her late 20s (not a real person): warm light-brown skin, " +
  "dark shoulder-length curly hair, friendly open face, small gold hoop earrings, natural everyday makeup.";

const STYLE =
  "Authentic smartphone UGC creator video still, vertical 9:16 framing, shot on a front phone camera at arm's length, " +
  "natural imperfect lighting, slight motion blur, realistic candid energy, looking into the lens mid-sentence, " +
  "ordinary real-world setting with believable clutter. NOT a studio photo, NOT posed fashion photography, no watermark, no text overlays.";

const SHEET = {
  id: "ugc-maya-sheet",
  prompt:
    `${MAYA} Clean presenter head-and-shoulders portrait for a creator profile card: facing camera with a warm genuine smile, ` +
    `soft ring-light catchlights in the eyes, plain warm-neutral apartment wall behind, wearing a simple sage-green crewneck t-shirt. ` +
    `Photorealistic, phone-camera look, vertical framing, no text, no watermark.`,
};

const SCENES = [
  {
    id: "ugc-maya-kitchen",
    prompt:
      "She stands at a bright kitchen counter holding a small amber glass serum bottle up beside her face, mid-demo, " +
      "morning light from a window, chopping board and mug in the soft background.",
  },
  {
    id: "ugc-maya-car",
    prompt:
      "She sits in the driver's seat of a parked car talking to a phone mounted on the dashboard, seatbelt on, " +
      "daylight through the windshield, honest car-review energy.",
  },
  {
    id: "ugc-maya-mirror",
    prompt:
      "Get-ready-with-me bathroom mirror shot: she films her reflection with her phone visible in hand, " +
      "shelf of everyday skincare products, warm vanity lighting.",
  },
  {
    id: "ugc-maya-unboxing",
    prompt:
      "She sits at a home desk opening a small cardboard delivery box toward the camera, delighted mid-reaction, " +
      "laptop and plant in the background, ring light glow.",
  },
  {
    id: "ugc-maya-gym",
    prompt:
      "Gym check-in selfie video still: she wears a workout top with a towel over one shoulder, slightly flushed, " +
      "weight racks blurred behind her, energetic real-talk expression.",
  },
  {
    id: "ugc-maya-cafe",
    prompt:
      "She sits at a café table talking straight to a propped-up phone, latte and pastry beside her, " +
      "soft window light, casual mid-story gesture.",
  },
];

/* ------------------------------ helpers ---------------------------------- */

async function saveManifest(patch) {
  let current = {};
  try {
    current = JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {}
  await writeFile(MANIFEST, JSON.stringify({ ...current, ...patch }, null, 2) + "\n");
}

/** PNG bytes → display-size JPEG via macOS sips (no extra deps), + manifest. */
async function persist(id, b64) {
  const tmp = new URL(`${id}.tmp.png`, OUT_DIR);
  const out = new URL(`${id}.jpg`, OUT_DIR);
  await writeFile(tmp, Buffer.from(b64, "base64"));
  await run("sips", ["-Z", "1280", "-s", "format", "jpeg", "-s", "formatOptions", "88", fileURLToPath(tmp), "--out", fileURLToPath(out)]);
  await unlink(tmp);
  await saveManifest({ [id]: `/generated/${id}.jpg` });
}

async function generate(prompt) {
  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, size: "1024x1536", quality: "high" }),
  });
  if (!res.ok) throw new Error((await res.text()).slice(0, 300));
  const b64 = (await res.json()).data?.[0]?.b64_json;
  if (!b64) throw new Error("no image in response");
  return b64;
}

/** Scene generation with the sheet as an identity reference (edits endpoint). */
async function generateWithRef(prompt, refPath) {
  const form = new FormData();
  form.append("model", MODEL);
  form.append("prompt", prompt);
  form.append("size", "1024x1536");
  form.append("quality", "high");
  const bytes = await readFile(refPath);
  form.append("image[]", new File([bytes], "maya-sheet.jpg", { type: "image/jpeg" }));
  const res = await fetch(`${BASE}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error((await res.text()).slice(0, 300));
  const b64 = (await res.json()).data?.[0]?.b64_json;
  if (!b64) throw new Error("no image in response");
  return b64;
}

/* -------------------------------- main ----------------------------------- */

const argv = process.argv.slice(2);
const onlyArg = argv.indexOf("--only");
const only = onlyArg >= 0 ? new Set(argv[onlyArg + 1].split(",")) : null;

await mkdir(OUT_DIR, { recursive: true });
const sheetPath = fileURLToPath(new URL(`${SHEET.id}.jpg`, OUT_DIR));

// 1. The character sheet — everything else references it for identity.
if (!only || only.has(SHEET.id)) {
  console.log(`generate ${SHEET.id}…`);
  await persist(SHEET.id, await generate(SHEET.prompt));
  console.log(`done     ${SHEET.id}`);
}

// 2. The six scenes — same face, different UGC settings.
const failures = [];
for (const scene of SCENES) {
  if (only && !only.has(scene.id)) continue;
  try {
    console.log(`generate ${scene.id}…`);
    const prompt =
      `The reference image shows Maya — keep her EXACT face, hair, skin tone and identity. ${MAYA}\n\n` +
      `${scene.prompt}\n\n${STYLE}`;
    await persist(scene.id, await generateWithRef(prompt, sheetPath));
    console.log(`done     ${scene.id}`);
  } catch (e) {
    console.error(`FAIL     ${scene.id}: ${e instanceof Error ? e.message : e}`);
    failures.push(scene.id);
  }
}

console.log(failures.length ? `finished with failures: ${failures.join(", ")}` : "all landing UGC images generated.");
process.exit(failures.length ? 1 : 0);
