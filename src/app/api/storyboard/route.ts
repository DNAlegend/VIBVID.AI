// The Storyboard Artist — turns a product + a commercial idea into the two
// halves of a product storyboard: a detailed SEEDANCE PROMPT (a premium
// product commercial, scene by scene with time ranges that sum to the chosen
// video length) and a single IMAGE prompt that renders the whole commercial
// as ONE picture — a 3×3 sheet of nine key frames. Writing runs on Claude
// when ANTHROPIC_API_KEY is set (Ark engine otherwise — see src/lib/llm.ts);
// the sheet renders on Seedream via Make's normal /api/generate path. The
// creator reviews both prompts before anything renders.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chatText, llmConfigured, llmEngine } from "@/lib/llm";
import { allowRequest, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { hasStudioAccess, ACTIVATE_MESSAGE } from "@/lib/access";

// Story mode writes up to 4 full storyboards in one Claude call (with
// adaptive thinking) — give it room.
export const maxDuration = 300;

const SYSTEM = `You are a world-class product-commercial director and storyboard artist working inside an AI video studio.
The creator gives you a PRODUCT, a commercial idea (in ANY language), and a video length in seconds. Direct it into ONE premium product commercial — the kind a high-end beverage, candy or electronics brand would run — then board it as nine key frames.

The product is the hero of every single frame: keep its shape, colors, label and materials IDENTICAL throughout. Decide its exact look once (bottle/can/wrapper shape, color palette, label design, finish) and repeat that identical one-line description wherever it appears. Lean on what sells product film: extreme macro texture, slow-motion liquid and particle simulation, crown splashes, ribbons and swirls, breaks and tears, floating ingredients, studio lighting with hard key light and rim light, speed ramps, orbit and whip-pan camera moves, a triumphant full-reveal hero shot near the end.

Respond with STRICT JSON only, no markdown fences:
{"title":"...","flow":"...","imagePrompt":"..."}

- "title": the commercial's name, same language as the brief, at most 6 words.

- "flow": the SEEDANCE PROMPT — the complete shooting spec for a cinematic AI video model, ALWAYS in English, structured EXACTLY as labeled blocks separated by blank lines (\n\n):
· Opening block: "Create a premium {length} second commercial for {the product}." followed by one sentence of production values, e.g. "Ultra realistic product advertising, high end {category} commercial, macro cinematography, slow motion liquid simulation, studio lighting, 4K quality, photorealistic details."
· One block per scene: "Scene 1 (0 to 3s): ..." — 1-4 second scenes whose time ranges add up EXACTLY to the video length, never more, never less. Each scene is 2-4 short sentences, hyper-detailed and descriptive: the product with one exact action or transformation, the physics named and behaving (thick creamy liquid exploding in slow motion, crumbs scattering, condensation beading, wrapper tearing, splash edges turning translucent), the camera framing AND movement (extreme macro, low angle orbit, slow cinematic push-in, hero beauty shot, final packshot), and the light source with its color and behavior (bright backlight creating glowing highlights, soft studio lighting, premium reflections). Keep the product perfectly consistent — repeat its identical description whenever it appears. The last scene is the final packshot: product perfectly centered, symmetrical composition, premium hero lighting, subtle camera hold.
· "Style:" block: one paragraph — the advertising genre, realistic physics, texture words, color palette, premium studio environment, hyper detailed product rendering, smooth transitions, elegant motion, and the guardrails "no people, no text overlays, no watermark, no distortion, no extra products" (drop "no people" only when the brief asks for people or characters).
· "Audio:" block: one sentence of foley and sound design synced to the on-screen actions, plus the music's energy or "clean premium sound design, ending in silence". No spoken lines unless the brief asks.
· 200-330 words total.

- "imagePrompt": ONE image-generation prompt, ALWAYS in English, describing a single picture: a professional product-storyboard sheet — a 3 columns × 3 rows grid of nine vertical frames on a clean white background with thin gutters; each cell carries exactly ONE small grey numeral in its bottom-left corner, numbered in reading order, and no other text anywhere. Then describe each of the nine cells in order ("Panel 1: ...") in one vivid sentence — the key frame of the commercial at that moment, in story order from opening tease to final hero shot, with its framing (macro, wide, orbit, reveal). State explicitly that the exact same product appears identical in every panel — same shape, colors, label and finish — and end with the shared style: ultra realistic product photography, studio lighting, and the commercial's color palette. 130-220 words.

Never put captions, logos, brand names or UI text inside the panels (panel numbers are the only text). Never reference real brand names, logos, trademarked characters or real public figures — describe original, generic products even when the brief names a brand.`;

const STORYBOARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "flow", "imagePrompt"],
  properties: {
    title: { type: "string" },
    flow: { type: "string" },
    imagePrompt: { type: "string" },
  },
};

/**
 * Story mode — the master planner. One story arc broken into N parts; each
 * part is a full storyboard of its own (a Seedance flow + a nine-panel sheet
 * prompt) and the cast stays word-for-word identical across every part.
 */
const STORY_SYSTEM = `You are a world-class commercial director and story architect working inside an AI video studio.
The creator gives you a story idea (in ANY language), a CAST (characters and products with their looks), a number of PARTS, and a per-part clip length in seconds. Plan ONE continuous story told across exactly that many parts — each part is a self-contained clip that advances the story, with a clear opening tease in part 1 and a payoff/hero ending in the final part. When PARTS is 1, the whole story is that single clip — tease, build and payoff inside it — and its part "title" is simply the story's title, never "Part 1".

CONSISTENCY IS EVERYTHING. Decide each cast member's exact look ONCE (from the provided looks) and repeat that identical one-line description word-for-word in EVERY part where they appear — characters keep the same face, hair, build and outfit; products keep the same shape, colors, label and finish. Reference sheets of the cast will be attached to every render, so write as if the model can see them.

Respond with STRICT JSON only, no markdown fences:
{"title":"...","logline":"...","parts":[{"title":"...","flow":"...","imagePrompt":"..."},...]}

- "title": the story's name, same language as the brief, at most 6 words.
- "logline": one sentence — the whole story arc, same language as the brief.
- "parts": EXACTLY the requested number of parts, in story order. Each part:
  · "title": the part's name (e.g. "Part 1 — The Spark"), same language as the brief.
  · "flow": that part's complete SEEDANCE PROMPT, ALWAYS in English, structured as labeled blocks separated by blank lines: an opening block "Create a premium {length} second clip — part {n} of {total} of \"{story title}\"." plus one sentence of production values; then "Scene 1 (0 to Xs): ..." blocks of 1-4 seconds whose ranges sum EXACTLY to the per-part length — each scene 2-4 hyper-detailed sentences: the cast with their identical descriptions, one exact action, named physics, camera framing AND movement, and the light; then a "Style:" paragraph (genre, palette, environment, "no text overlays, no watermark, no distortion"); then an "Audio:" sentence (foley synced to actions + music energy; a spoken line under 12 words in double quotes only if the brief asks). 150-280 words per part.
  · "imagePrompt": ONE image prompt, ALWAYS in English, drawing that part as a professional storyboard sheet — a 3 columns × 3 rows grid of nine vertical frames on a clean white background with thin gutters, each cell carrying exactly ONE small grey numeral in its bottom-left corner and no other text anywhere. Describe each of the nine cells ("Panel 1: ...") in one vivid sentence covering that part's beats in order, state that the exact same cast appears identical in every panel, and end with the shared style. 120-200 words.

Never put captions, logos or brand names inside panels. Never reference real brands, trademarked characters or real public figures — original, generic descriptions even when the brief names one.`;

const STORY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "logline", "parts"],
  properties: {
    title: { type: "string" },
    logline: { type: "string" },
    parts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "flow", "imagePrompt"],
        properties: {
          title: { type: "string" },
          flow: { type: "string" },
          imagePrompt: { type: "string" },
        },
      },
    },
  },
};

export async function POST(req: Request) {
  if (!llmConfigured()) {
    return NextResponse.json({ error: "Storyboard writer not configured" }, { status: 501 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Paid-only: an unsubscribed account can sign in but can't spend our tokens.
  if (!(await hasStudioAccess(sb, userData.user.id, userData.user.email))) {
    return NextResponse.json({ error: ACTIVATE_MESSAGE }, { status: 402 });
  }

  if (!(await allowRequest(sb, "storyboard", 20))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const brief = typeof body?.brief === "string" ? body.brief.trim().slice(0, 2000) : "";
  if (!brief) return NextResponse.json({ error: "Empty brief" }, { status: 400 });
  // The commercial's length — scenes must sum to it (Make offers 5/10/15s).
  // Any second in Seedance's 4–15 range (defaults to 10).
  const durationSec = Math.min(15, Math.max(4, Math.round(Number(body?.durationSec) || 10)));
  // The hero product: a saved Product's name + look, or absent (brief describes it).
  const product =
    body?.product && typeof body.product === "object"
      ? {
          name: String(body.product.name ?? "").slice(0, 80),
          look: String(body.product.look ?? "").slice(0, 400),
        }
      : null;

  // ---- Story mode: one continuous arc as a single storyboard (the UI always
  // sends parts: 1 now; 2-4 still parse for older clients).
  const partsCount = Math.min(4, Math.max(0, Math.round(Number(body?.parts) || 0)));
  if (partsCount >= 1) {
    const cast: { type: string; name: string; look: string }[] = Array.isArray(body?.cast)
      ? body.cast
          .filter((c: unknown) => c && typeof c === "object")
          .slice(0, 8)
          .map((c: { type?: unknown; name?: unknown; look?: unknown }) => ({
            type: c.type === "product" ? "product" : "character",
            name: String(c.name ?? "").slice(0, 80),
            look: String(c.look ?? "").slice(0, 400),
          }))
      : [];
    const storyMsg = [
      `Parts: exactly ${partsCount}. Per-part clip length: exactly ${durationSec} seconds.`,
      cast.length
        ? `Cast (keep each identical in every part; their reference sheets are attached to every render):\n${cast
            .map((c) => `- ${c.type}: ${c.name}${c.look ? ` — ${c.look}` : ""}`)
            .join("\n")}`
        : null,
      `Story idea: ${brief}`,
    ]
      .filter(Boolean)
      .join("\n");
    let rawStory: string;
    try {
      rawStory = await chatText({
        system: STORY_SYSTEM,
        user: storyMsg,
        // Each part carries a full flow + sheet prompt; scale with the count.
        maxTokens: 2600 * partsCount + 600,
        temperature: 0.85,
        jsonSchema: STORY_SCHEMA,
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message.slice(0, 200) : "unknown error";
      return NextResponse.json({ error: `Story writer error: ${detail}` }, { status: 502 });
    }
    const m = rawStory.match(/\{[\s\S]*\}/);
    try {
      const parsed = JSON.parse(m ? m[0] : rawStory);
      const parts = (Array.isArray(parsed?.parts) ? parsed.parts : [])
        .slice(0, partsCount)
        .map((p: { title?: unknown; flow?: unknown; imagePrompt?: unknown }) => ({
          title: String(p?.title ?? "").slice(0, 120),
          flow: String(p?.flow ?? "").slice(0, 6000),
          imagePrompt: String(p?.imagePrompt ?? "").slice(0, 3000),
        }))
        .filter((p: { flow: string; imagePrompt: string }) => p.flow && p.imagePrompt);
      if (parts.length < 1) throw new Error("no parts");
      return NextResponse.json({
        title: String(parsed?.title ?? "").slice(0, 120),
        logline: String(parsed?.logline ?? "").slice(0, 300),
        parts,
        durationSec,
        engine: llmEngine(),
      });
    } catch {
      return NextResponse.json(
        { error: "The story writer returned nothing usable — try again" },
        { status: 502 },
      );
    }
  }

  const userMsg = [
    `Video length: exactly ${durationSec} seconds.`,
    product?.name
      ? `Product (the hero of every frame — keep it identical throughout): ${product.name}${product.look ? ` — ${product.look}` : ""}. Reference photos of this exact product will also be given to the image model.`
      : null,
    `Commercial idea: ${brief}`,
  ]
    .filter(Boolean)
    .join("\n");

  let raw: string;
  try {
    raw = await chatText({
      system: SYSTEM,
      user: userMsg,
      // Scene-by-scene flow + the nine-cell sheet prompt + JSON overhead.
      maxTokens: 3200,
      temperature: 0.85,
      jsonSchema: STORYBOARD_SCHEMA,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 200) : "unknown error";
    return NextResponse.json({ error: `Storyboard writer error: ${detail}` }, { status: 502 });
  }

  // Models sometimes wrap JSON in fences or prose — extract the object.
  const match = raw.match(/\{[\s\S]*\}/);
  let title = "";
  let flow = "";
  let imagePrompt = "";
  try {
    const parsed = JSON.parse(match ? match[0] : raw);
    title = typeof parsed?.title === "string" ? parsed.title.slice(0, 120) : "";
    flow = typeof parsed?.flow === "string" ? parsed.flow.slice(0, 6000) : "";
    imagePrompt = typeof parsed?.imagePrompt === "string" ? parsed.imagePrompt.slice(0, 3000) : "";
  } catch {
    /* fall through to the empty check below */
  }
  if (!flow || !imagePrompt) {
    return NextResponse.json(
      { error: "The storyboard writer returned nothing usable — try again" },
      { status: 502 },
    );
  }
  // `engine` is a debug field the UI ignores — confirms which writer ran.
  return NextResponse.json({ title, flow, imagePrompt, durationSec, engine: llmEngine() });
}
