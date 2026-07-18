// Complete a GUEST checkout: turn "payment succeeded" into "signed in".
//
// The buyer paid before having a session (pay-first onboarding). Embedded
// Checkout returns them to /subscribe/complete, which POSTs the session id
// here. We verify — server-side, against Stripe — that the session is real
// and PAID, resolve the account the checkout created (from the session's own
// metadata, never from client input), and mint a one-time magic-link token
// the browser redeems with supabase.auth.verifyOtp() to become a session.
//
// One-time by construction:
//   · only accounts that have NEVER signed in qualify (an established account
//     already knows how to log in — we never mint sessions for those), and
//   · a `guest_activated` metadata flag is set before the token is returned,
//     so replaying the same session id cannot mint a second token.
// The token itself is also single-use and short-lived (Supabase).
//
// Failure here never loses a payment: the webhook grants credits on its own
// track, and the buyer can always OTP-login with the same email.

import { NextResponse } from "next/server";
import { supabaseAdmin, isEstablishedAccount } from "@/lib/supabase-admin";
import { stripe, stripeConfigured } from "@/lib/stripe";

export const maxDuration = 20;

export async function POST(req: Request) {
  if (!stripeConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 501 });
  }
  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // The session id is the capability here — unguessable, delivered only to
  // the payer's browser by Stripe's return redirect.
  let session;
  try {
    session = await stripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: "Unknown checkout session" }, { status: 404 });
  }
  if (session.payment_status !== "paid") {
    return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
  }
  const userId = session.metadata?.user_id;
  if (!userId) return NextResponse.json({ error: "Unknown checkout session" }, { status: 404 });

  const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  const user = userRes?.user;
  if (userErr || !user?.email) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Established accounts (ever signed in, already activated once, or with a
  // paid purchase / credits behind them) sign in the normal way — never hand
  // a session to whoever replays the checkout session id. This is the SAME
  // definition the guest-checkout gate uses; keeping them identical is what
  // closes the account-takeover window on a paid-but-not-yet-entered account.
  if (await isEstablishedAccount(user)) {
    return NextResponse.json({ signIn: true, email: user.email });
  }

  // The subscribe form shows the ToS/Privacy consent line before payment —
  // record the acceptance on the account it created (same as OTP signup does).
  await supabaseAdmin
    .from("profiles")
    .update({ accepted_terms_at: new Date().toISOString() })
    .eq("id", userId)
    .is("accepted_terms_at", null);

  // Burn the one-time flag BEFORE handing out the token.
  const { error: flagErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { ...user.user_metadata, guest_activated: true },
  });
  if (flagErr) {
    console.error("[checkout/complete] flag update failed:", flagErr.message);
    return NextResponse.json({ signIn: true, email: user.email });
  }

  const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    console.error("[checkout/complete] generateLink failed:", linkErr?.message);
    return NextResponse.json({ signIn: true, email: user.email });
  }

  return NextResponse.json({ tokenHash, email: user.email });
}
