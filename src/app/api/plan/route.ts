// The Strategist — turns a creator's goal ("give me 5 videos that will go
// viral for my brand") into distinct, production-ready video concepts.
// Script writing runs on Claude when ANTHROPIC_API_KEY is set (Ark engine
// otherwise — see src/lib/llm.ts). Each concept lands on the Plan surface,
// where the creator can send it to Make as a job. Nothing is generated here.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chatText, llmConfigured } from "@/lib/llm";

export const maxDuration = 60;

const SYSTEM = `You are a viral short-form video strategist and commercial director working inside an AI video studio.
Given a creator's goal and a clip length, invent the requested number of DISTINCT, concrete video concepts that could perform on TikTok / Reels / Shorts.
For each concept provide:
- "title": a punchy concept name, at most 8 words, in the same language as the goal.
- "hook": one sentence on why it stops the scroll, same language as the goal.
- "prompt": an EXTREMELY DETAILED production blueprint for a cinematic AI video generation model — ALWAYS in English, written for a clip of EXACTLY the given length.
Blueprint rules:
- Structure it as a second-by-second timeline ("0-2s: ... 2-5s: ... 5-8s: ...") whose beats add up to the full duration — never shorter, never longer.
- Every beat must be concrete and visual: one subject with an exact action, setting and props, camera movement and framing (macro, POV, dolly-in, whip-pan, orbit, crash-zoom...), lighting and color, pacing and transitions. Prefer one strong action per beat over several vague ones.
- The model generates NATIVE AUDIO: after the timeline, add one "Audio:" sentence directing sound design — ambience, foley synced to the action, music energy, and (only when it strengthens the concept) one short spoken line in double quotes with the speaker described.
- End with one sentence of overall mood, style and color grade.
- NEVER request on-screen text, captions, subtitles, watermarks, logos or UI overlays — the model renders text poorly.
- Keep one consistent protagonist and location logic across beats so the clip cuts together as one continuous idea.
- 100–180 words per prompt. This is the complete blueprint the video model shoots from — the more precise, the better the result.
Never reference real brand names, logos, trademarked or copyrighted characters, franchises, or real public figures.
Make the concepts genuinely different from each other: different formats (POV, unboxing, transformation, walkthrough, testimonial...), settings and emotional angles.
Output STRICT JSON only, no markdown fences, exactly: {"ideas":[{"title":"...","hook":"...","prompt":"..."}]}`;

const IDEAS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "hook", "prompt"],
        properties: {
          title: { type: "string" },
          hook: { type: "string" },
          prompt: { type: "string" },
        },
      },
    },
  },
};

export async function POST(req: Request) {
  if (!llmConfigured()) {
    return NextResponse.json({ error: "Strategist not configured" }, { status: 501 });
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

  const body = await req.json().catch(() => null);
  const brief = typeof body?.brief === "string" ? body.brief.trim().slice(0, 2000) : "";
  if (!brief) return NextResponse.json({ error: "Empty brief" }, { status: 400 });
  const count = Math.min(10, Math.max(1, Number(body?.count) || 5));
  // Seedance accepts 4–15s; the UI offers 5/10/15.
  const durationSec = Math.min(15, Math.max(4, Number(body?.durationSec) || 5));

  let raw: string;
  try {
    raw = await chatText({
      system: SYSTEM,
      user: `Number of concepts: ${count}.\nClip length: exactly ${durationSec} seconds.\nCreator's goal: ${brief}`,
      maxTokens: 550 * count + 200,
      temperature: 0.9,
      jsonSchema: IDEAS_SCHEMA,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 200) : "unknown error";
    return NextResponse.json({ error: `Strategist error: ${detail}` }, { status: 502 });
  }
  // Models sometimes wrap JSON in fences or prose — extract the object.
  const match = raw.match(/\{[\s\S]*\}/);
  let ideas: Array<{ title: string; hook: string; prompt: string }> = [];
  try {
    const parsed = JSON.parse(match ? match[0] : raw);
    ideas = (Array.isArray(parsed?.ideas) ? parsed.ideas : [])
      .filter(
        (i: unknown): i is { title: string; hook: string; prompt: string } =>
          !!i &&
          typeof (i as { title?: unknown }).title === "string" &&
          typeof (i as { prompt?: unknown }).prompt === "string",
      )
      .map((i: { title: string; hook?: string; prompt: string }) => ({
        title: String(i.title).slice(0, 120),
        hook: String(i.hook ?? "").slice(0, 300),
        prompt: String(i.prompt).slice(0, 1200),
      }))
      .slice(0, count);
  } catch {
    ideas = [];
  }
  if (ideas.length === 0) {
    return NextResponse.json({ error: "The Strategist returned nothing usable — try again" }, { status: 502 });
  }
  return NextResponse.json({ ideas });
}
