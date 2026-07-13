// Start a checkout for a top-up pack or a subscription plan.
// Records a pending purchase (server-priced from the billing catalog — never
// trusts the client's amount), then hands the browser what it needs to pay:
//   • Paddle (our merchant of record, preferred): the purchase id + Paddle
//     price id + public client token, so Paddle.js can open the overlay.
//   • MamoPay (legacy fallback): a hosted payment-link URL.
//
// Two ways in: a signed-in caller (Authorization header), or a guest with just
// an email — we create their account server-side so they can pay first and
// confirm the account after payment.

import { NextResponse } from "next/server";
import { supabaseAdmin, userIdFromRequest, userIdForEmail } from "@/lib/supabase-admin";
import { billingItem } from "@/lib/billing";
import { createPaymentLink, mamoConfigured } from "@/lib/mamopay";
import {
  paddleConfigured,
  priceIdForItem,
  paddleClientToken,
  paddleEnvironment,
} from "@/lib/paddle";

export const maxDuration = 20;

export async function POST(req: Request) {
  const usePaddle = paddleConfigured();
  if ((!usePaddle && !mamoConfigured()) || !supabaseAdmin) {
    // No payment provider wired up — the client falls back to demo credits.
    return NextResponse.json({ error: "Payments not configured" }, { status: 501 });
  }
  const body = await req.json().catch(() => null);
  const item = billingItem(typeof body?.itemId === "string" ? body.itemId : "");
  if (!item) return NextResponse.json({ error: "Unknown item" }, { status: 400 });

  let userId = await userIdFromRequest(req);
  let customerEmail: string | null = null;
  if (userId) {
    // Inline (on-page) checkout needs the payer's email — look it up.
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

  // The browser origin drives the return URLs so this works on any domain.
  const origin =
    (typeof body?.origin === "string" && /^https?:\/\//.test(body.origin) && body.origin) ||
    req.headers.get("origin") ||
    "https://vibvid.ai";

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

  // Preferred path: Paddle. Hand the browser the price id + public client token
  // and let Paddle.js open the hosted overlay. custom_data.purchase_id ties the
  // resulting transaction back to this pending row so the webhook can settle it.
  if (usePaddle) {
    const priceId = priceIdForItem(item.id);
    if (!priceId) {
      await supabaseAdmin.from("credit_purchases").update({ status: "failed" }).eq("id", purchase.id);
      return NextResponse.json({ error: "This item isn’t available for purchase yet" }, { status: 500 });
    }
    return NextResponse.json({
      provider: "paddle",
      purchaseId: purchase.id,
      priceId,
      clientToken: paddleClientToken(),
      environment: paddleEnvironment(),
      email: customerEmail,
    });
  }

  const link = await createPaymentLink({
    title: item.kind === "subscription" ? `VIBVID ${item.label} plan` : `${item.credits} credits`,
    amount: item.amount,
    currency: item.currency,
    returnUrl: `${origin}/app?purchase=success`,
    failureUrl: `${origin}/app?purchase=failed`,
    externalId: purchase.id,
    customData: { purchase_id: purchase.id, user_id: userId, credits: String(item.credits) },
    subscription:
      item.kind === "subscription" ? { frequency: "monthly", frequency_interval: 1 } : undefined,
    customer: customerEmail ? { email: customerEmail } : undefined,
  });

  if ("error" in link) {
    await supabaseAdmin.from("credit_purchases").update({ status: "failed" }).eq("id", purchase.id);
    return NextResponse.json({ error: link.error }, { status: 502 });
  }

  await supabaseAdmin
    .from("credit_purchases")
    .update({ mamo_link_id: link.id })
    .eq("id", purchase.id);

  return NextResponse.json({ provider: "mamopay", url: link.paymentUrl });
}
