// Stripe webhook — grants credits after a verified payment.
//
// Security model: we (1) verify Stripe's signature on the raw body against
// the endpoint's signing secret, then (2) only credit a purchase that matches
// a pending purchase WE created, for a specific user, at the amount we
// recorded. Credits are granted through settle_charge(), idempotent on the
// Stripe charge id — the payment intent for one-off packs, the invoice id for
// subscriptions (unique per billing period) — so replays and each renewal
// credit exactly once.
//
// Register the endpoint in the Stripe dashboard (Developers → Webhooks)
// pointing at /api/stripe/webhook, subscribed to checkout.session.completed
// and invoice.paid, and set its signing secret as STRIPE_WEBHOOK_SECRET.

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyStripeWebhook, invoicePurchaseMetadata } from "@/lib/stripe";

export const maxDuration = 20;

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not configured" }, { status: 501 });
  }

  const raw = await req.text();
  const event = verifyStripeWebhook(raw, req.headers.get("stripe-signature"));
  if (!event) {
    console.warn("[stripe webhook] signature verification failed");
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  // Each handler resolves to { chargeId, purchaseId, paidCents, currency }
  // or null to ack-and-ignore.
  let chargeId: string | undefined;
  let purchaseId: string | undefined;
  let paidCents: number | undefined;
  let paidCurrency: string | undefined;

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    // Subscriptions are credited from invoice.paid (which also covers every
    // renewal) — crediting here too would double-grant the first cycle.
    if (session.mode !== "payment") return NextResponse.json({ ok: true });
    if (session.payment_status !== "paid") return NextResponse.json({ ok: true });
    purchaseId = session.metadata?.purchase_id ?? session.client_reference_id ?? undefined;
    chargeId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? session.id;
    paidCents = session.amount_total ?? undefined;
    paidCurrency = session.currency ?? undefined;
  } else if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.status !== "paid" || !invoice.id) return NextResponse.json({ ok: true });
    const meta = await invoicePurchaseMetadata(invoice);
    purchaseId = meta?.purchase_id;
    chargeId = invoice.id; // unique per billing period → one grant per cycle
    paidCents = invoice.amount_paid;
    paidCurrency = invoice.currency ?? undefined;
  } else {
    return NextResponse.json({ ok: true }); // ack unrelated events so Stripe stops retrying
  }

  if (!chargeId || !purchaseId) {
    console.warn("[stripe webhook] no purchase_id on", event.type, chargeId ?? "");
    return NextResponse.json({ ok: true });
  }

  const { data: purchase } = await supabaseAdmin
    .from("credit_purchases")
    .select("id, user_id, credits, amount, currency")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) {
    console.warn("[stripe webhook] unknown purchase", purchaseId);
    return NextResponse.json({ ok: true });
  }

  // Amount + currency must match what we recorded exactly — prices are fixed
  // server-side with no tax/promos, so any difference means a mixed-up or
  // tampered purchase row. Stripe reports minor units (cents).
  const expectedCents = Math.round(Number(purchase.amount) * 100);
  if (paidCents !== expectedCents) {
    console.warn(`[stripe webhook] amount mismatch: paid ${paidCents} vs expected ${expectedCents}`);
    return NextResponse.json({ ok: true });
  }
  if ((paidCurrency ?? "usd").toUpperCase() !== (purchase.currency ?? "USD")) {
    console.warn(`[stripe webhook] currency mismatch: ${paidCurrency} vs ${purchase.currency}`);
    return NextResponse.json({ ok: true });
  }

  // Idempotent grant, keyed on the Stripe charge id (unique per charge and
  // per renewal invoice), so each billing period credits exactly once.
  const { data: granted, error } = await supabaseAdmin.rpc("settle_charge", {
    p_charge_id: chargeId,
    p_purchase_id: purchase.id,
    p_user: purchase.user_id,
    p_credits: purchase.credits,
  });
  if (error) {
    console.error("[stripe webhook] settle_charge failed:", error.message);
    return NextResponse.json({ error: "settle failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, credited: granted === true });
}
