import { NextResponse } from "next/server";
import { emailFounder } from "@/lib/notify-founder";

// Called by the database trigger on auth.users insert (see the
// signup_notify migration) — every new account, whatever door it came
// through (OTP sign-up, guest checkout), emails the founder.
// Auth: a shared secret header set in the trigger and in Vercel env.

export async function POST(req: Request) {
  const secret = process.env.SIGNUP_NOTIFY_SECRET;
  if (!secret || req.headers.get("x-signup-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string; created_at?: string };
  const email = (body.email ?? "").slice(0, 320) || "(no email on record)";
  const when = body.created_at ? new Date(body.created_at).toUTCString() : new Date().toUTCString();

  const sent = await emailFounder(
    `New VIBVID account: ${email}`,
    `Someone just created a VIBVID account.\n\nEmail: ${email}\nWhen: ${when}\n\n— vibvid.ai`,
  );
  return NextResponse.json({ ok: true, sent });
}
