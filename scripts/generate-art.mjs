// Generate the landing-page showcase art with real Seedream (ByteDance) images
// via the BytePlus ModelArk API, replacing the hand-drawn SVG placeholders.
//
// Setup:
//   1. Get an API key from the BytePlus ModelArk console (console.byteplus.com)
//      and enable a Seedream text-to-image endpoint.
//   2. Put it in .env.local:  ARK_API_KEY=...
//   3. Run:  npm run generate:art
//
// Output lands in public/generated/*.png. Then point src/lib/showcase.ts at
// /generated/<name>.png — the landing page reads only from that file.

import { writeFile, mkdir, readFile } from "node:fs/promises";

// Minimal .env.local loader — no dependency needed.
try {
  const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const KEY = process.env.ARK_API_KEY;
const BASE = process.env.ARK_BASE_URL ?? "https://ark.ap-southeast.bytepluses.com/api/v3";
// Confirmed-valid on BytePlus ModelArk (must be Activated in the Ark console).
const MODEL = process.env.ARK_IMAGE_MODEL ?? "seedream-4-0-250828";

if (!KEY) {
  console.error("Missing ARK_API_KEY. Add it to .env.local (see header of this script).");
  process.exit(1);
}

const STYLE =
  "cinematic film still, dramatic lighting, rich color grading, shallow depth of field, photorealistic, 35mm film grain";

const SHOTS = [
  { file: "hero-neon-city", size: "1280x720", prompt: `Lone samurai in neon-trimmed armor walking through a rain-soaked Tokyo street canyon at night, glowing pink and cyan signs reflecting in puddles, volumetric haze, ${STYLE}` },
  { file: "art-product-reveal", size: "1280x720", prompt: `Luxury perfume bottle on a dark pedestal under a single warm spotlight, floating dust particles, purple and teal accent glow, studio product photography, ${STYLE}` },
  { file: "art-neon-tokyo", size: "1024x1024", prompt: `Neon Tokyo skyline at night over a still river, giant pink moon, glowing signs mirrored in the water, ${STYLE}` },
  { file: "art-cyber-detective", size: "1024x1024", prompt: `Trench-coat detective silhouetted in a warmly lit doorway of a rainy cyberpunk alley, pink neon sign on brick wall, fog rolling on the ground, ${STYLE}` },
  { file: "art-forest-spirit", size: "1024x1024", prompt: `Glowing spectral deer with luminous antlers standing in a dark misty forest, god rays through the canopy, fireflies drifting, ${STYLE}` },
  { file: "art-ballet", size: "1024x1024", prompt: `Ballerina in arabesque silhouetted under a single stage spotlight, red velvet curtains, dust motes in the light beam, ${STYLE}` },
  { file: "art-desert-run", size: "1280x720", prompt: `Runner on a dune ridge at sunset, giant golden sun on the horizon, drifting sand, purple and orange sky, ${STYLE}` },
  { file: "art-underwater-city", size: "1024x1024", prompt: `Futuristic underwater city inside glass domes on the ocean floor, light rays from the surface, schools of fish and rising bubbles, ${STYLE}` },
  { file: "art-astro-mars", size: "1024x1024", prompt: `Astronaut floating above a glowing Mars colony dome at night, ringed planet and stars in the sky, tether drifting, ${STYLE}` },
  { file: "art-cloud-temple", size: "1024x1024", prompt: `Red torii gate and shrine on a floating island above a sea of clouds at sunset, golden sun behind, distant birds, ${STYLE}` },
  { file: "art-evening-gown", size: "1024x1024", prompt: `Elegant magenta silk evening gown on a dress form under a single spotlight in a dark atelier, sparkling fabric, glossy floor reflection, ${STYLE}` },
];

await mkdir(new URL("../public/generated", import.meta.url), { recursive: true });

for (const s of SHOTS) {
  process.stdout.write(`Generating ${s.file} … `);
  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      prompt: s.prompt,
      size: s.size,
      response_format: "b64_json",
      watermark: false,
    }),
  });
  if (!res.ok) {
    console.error(`FAILED (${res.status}): ${await res.text()}`);
    process.exit(1);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    console.error(`FAILED: no image in response: ${JSON.stringify(json).slice(0, 300)}`);
    process.exit(1);
  }
  await writeFile(new URL(`../public/generated/${s.file}.png`, import.meta.url), Buffer.from(b64, "base64"));
  console.log("done");
}

console.log("\nAll images written to public/generated/.");
console.log("Next: update src/lib/showcase.ts srcs from /art/<name>.svg to /generated/<name>.png");
