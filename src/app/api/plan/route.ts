// The Strategist — turns a creator's goal ("give me 5 videos that will go
// viral for my brand") into distinct, production-ready video concepts via an
// Ark LLM. Each concept lands on the Plan surface, where the creator can send
// it to Make as a job. Nothing is generated from here.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ARK_BASE = process.env.ARK_BASE_URL ?? "https://ark.ap-southeast.bytepluses.com/api/v3";
const STRATEGIST_MODEL = process.env.ARK_DIRECTOR_MODEL ?? "deepseek-v4-flash-260425";

export const maxDuration = 60;

const SYSTEM = `You are a viral short-form video strategist and commercial director working inside an AI video studio.
Given a creator's goal, invent the requested number of DISTINCT, concrete video concepts that could perform on TikTok / Reels / Shorts.
For each concept provide:
- "title": a punchy concept name, at most 8 words, in the same language as the goal.
- "hook": one sentence on why it stops the scroll, same language as the goal.
- "prompt": a production-ready prompt for a cinematic AI video generation model — ALWAYS in English, one flowing paragraph of 40–80 words covering subject and action, setting, camera movement, lighting, mood and style. Concrete and visual; verbs of motion.
Never reference real brand names, logos, trademarked or copyrighted characters, franchises, or real public figures.
Make the concepts genuinely different from each other: different formats (POV, unboxing, transformation, walkthrough, testimonial...), settings and emotional angles.
Output STRICT JSON only, no markdown fences, exactly: {"ideas":[{"title":"...","hook":"...","prompt":"..."}]}`;

export async function POST(req: Request) {
  if (!process.env.ARK_API_KEY) {
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

  const res = await fetch(`${ARK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ARK_API_KEY}`,
    },
    body: JSON.stringify({
      model: STRATEGIST_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Number of concepts: ${count}.\nCreator's goal: ${brief}` },
      ],
      max_tokens: 350 * count + 200,
      temperature: 0.9,
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    return NextResponse.json({ error: `Strategist error: ${detail}` }, { status: 502 });
  }
  const json = await res.json();
  const raw: string = json.choices?.[0]?.message?.content?.trim() ?? "";
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
