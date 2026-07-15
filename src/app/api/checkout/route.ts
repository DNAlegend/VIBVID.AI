// Start a checkout for a top-up pack or a subscription plan.
// Records a pending purchase (server-priced from the billing catalog — never
// trusts the client's amount), then creates a Stripe Checkout Session and
// hands the browser its URL to redirect to. Stripe is our payment processor;
// VIBVID.AI is the seller. We never touch card data.
//
// Two ways in: a signed-in caller (Authorization header), or a guest with just
// an email — we create their account server-side so they can pay first and
// confirm the account after payment.

import { NextResponse } from "next/server";
import { supabaseAdmin, userIdFromRequest, userIdForEmail } from "@/lib/supabase-admin";
import { billingItem } from "@/lib/billing";
import { stripeConfigured, createStripeCheckout } from "@/lib/stripe";

export const maxDuration = 20;

export async function POST(req: Request) {
  if (!stripeConfigured() || !supabaseAdmin) {
    // Stripe not wired up — the client falls back to demo credits.
    return NextResponse.json({ error: "Payments not configured" }, { status: 501 });
  }
  const body = await req.json().catch(() => null);
  const item = billingItem(typeof body?.itemId === "string" ? body.itemId : "");
  if (!item) return NextResponse.json({ error: "Unknown item" }, { status: 400 });

  // Where Stripe redirects the buyer back to. Trust our own header origin
  // first, falling back to a client-sent origin for local dev.
  const origin =
    req.headers.get("origin") ??
    (typeof body?.origin === "string" ? body.origin : new URL(req.url).origin);

  let userId = await userIdFromRequest(req);
  let customerEmail: string | null = null;
  if (userId) {
    // Look up the payer's email to prefill Stripe's checkout.
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    customerEmail = data.user?.email ?? null;
  } else {
    // Guest checkout: email → account created silently → straight to payment.
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter your email to continue" }, { status: 401 });
    }
    userId = await userIdForEmail(email);
    if (!userId) {
      return NextResponse.json({ error: "Could not set up your account" }, { status: 500 });
    }
    customerEmail = email;
  }

  // Record the intent first so the webhook has something to reconcile against.
  const { data: purchase, error: insErr } = await supabaseAdmin
    .from("credit_purchases")
    .insert({
      user_id: userId,
      kind: item.kind,
      item: item.id,
      credits: item.credits,
      amount: item.amount,
      currency: item.currency,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !purchase) {
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  // Create the Checkout Session. The purchase id rides in the session (and,
  // for plans, the subscription) metadata so the webhook can settle the first
  // charge and every renewal against this pending row.
  try {
    const session = await createStripeCheckout({
      item,
      purchaseId: purchase.id,
      userId,
      origin,
      email: customerEmail,
    });
    return NextResponse.json({
      provider: "stripe",
      purchaseId: purchase.id,
      checkoutUrl: session.url,
    });
  } catch (e) {
    await supabaseAdmin.from("credit_purchases").update({ status: "failed" }).eq("id", purchase.id);
    console.error("[checkout] Stripe session creation failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }
}
