// Start an on-site checkout for a subscription plan (subscription-only: one-time
// credit packs are rejected — members upgrade their plan for more credits).
// Records a pending purchase (server-priced from the billing catalog — never
// trusts the client's amount), ensures the user has a Stripe customer, then
// creates an Embedded Checkout Session and returns its client secret. The
// browser mounts Stripe's payment form in-page — no redirect. VIBVID.AI is the
// seller; we never touch card data.
//
// Two ways in: a signed-in caller (Authorization header), or a guest with just
// an email — we create their account server-side so they can pay first and
// confirm the account after payment.

import { NextResponse } from "next/server";
import { supabaseAdmin, userIdFromRequest, guestUserForEmail } from "@/lib/supabase-admin";
import { getBillingCustomer, saveBillingCustomer } from "@/lib/billing-customer";
import { billingItem } from "@/lib/billing";
import { stripeConfigured, createEmbeddedCheckout, ensureStripeCustomer, liveSubscription } from "@/lib/stripe";

export const maxDuration = 20;

/** Pull one cookie's value out of a raw Cookie header, or null if absent. */
function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function POST(req: Request) {
  if (!stripeConfigured() || !supabaseAdmin) {
    // Stripe not wired up — the client falls back to demo credits (local only).
    return NextResponse.json({ error: "Payments not configured" }, { status: 501 });
  }
  const body = await req.json().catch(() => null);
  const item = billingItem(typeof body?.itemId === "string" ? body.itemId : "");
  if (!item) return NextResponse.json({ error: "Unknown item" }, { status: 400 });
  // Subscription-only for now: no one-time credit packs. Members who need more
  // credits upgrade their plan (or wait for the cycle refill).
  if (item.kind !== "subscription") {
    return NextResponse.json(
      { error: "Credit packs aren’t available — upgrade your plan for more credits." },
      { status: 400 },
    );
  }

  // Where Embedded Checkout returns the buyer once done — always our own site.
  const origin =
    req.headers.get("origin") ??
    (typeof body?.origin === "string" ? body.origin : new URL(req.url).origin);

  let userId = await userIdFromRequest(req);
  let customerEmail: string | null = null;
  // Guest checkout (no session): pay first, account after — allowed once per
  // email. Established accounts are told to log in and pay inside instead.
  let isGuest = false;
  if (userId) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    customerEmail = data.user?.email ?? null;
  } else {
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter your email to continue" }, { status: 401 });
    }
    // Cap the unauthenticated path per client IP per hour, BEFORE creating any
    // account / Stripe customer / DB row — otherwise a script iterating emails
    // could spam real users, customers and enumerate accounts. Fail-open if the
    // RPC isn't deployed yet (mirrors the authenticated limiter).
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { data: allowed, error: rlErr } = await supabaseAdmin.rpc("consume_guest_rate_limit", {
      p_key: ip,
      p_bucket: "guest_checkout",
      p_max: 15,
    });
    if (!rlErr && allowed === false) {
      return NextResponse.json(
        { error: "Too many attempts — take a short break and try again." },
        { status: 429 },
      );
    }
    const guest = await guestUserForEmail(email);
    if (!guest) {
      return NextResponse.json({ error: "Could not set up your account" }, { status: 500 });
    }
    if (guest.exists) {
      return NextResponse.json(
        { error: "This email already has an account — log in to subscribe.", code: "account_exists" },
        { status: 409 },
      );
    }
    userId = guest.userId;
    customerEmail = email;
    isGuest = true;
  }

  // Ensure the user has one Stripe customer so every purchase, invoice and
  // saved card lives together (the account page manages them there).
  const existing = await getBillingCustomer(userId);
  let customerId: string;
  try {
    customerId = await ensureStripeCustomer({
      existingId: existing?.customerId ?? null,
      userId,
      email: customerEmail,
    });
    if (!existing) await saveBillingCustomer(userId, customerId);
  } catch (e) {
    console.error("[checkout] customer setup failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }

  // One live subscription per account: buying a second plan would silently
  // double-bill (Stripe happily stacks subscriptions on one customer). Plan
  // changes go through the Account page's Switch plan, which updates the
  // existing subscription in place.
  if (item.kind === "subscription") {
    try {
      const current = await liveSubscription(customerId);
      if (current) {
        return NextResponse.json(
          {
            error: "You already have an active plan — switch it from Account & billing instead.",
            code: "already_subscribed",
          },
          { status: 409 },
        );
      }
    } catch {
      /* Stripe lookup hiccup — let checkout proceed rather than block a sale. */
    }
  }

  // Capture Meta's match-quality signals now, while we still have the raw
  // request — the webhook (no browser context) reads them back later to
  // report this purchase via the Conversions API.
  const cookieHeader = req.headers.get("cookie");
  const fbp = cookieValue(cookieHeader, "_fbp");
  const fbc = cookieValue(cookieHeader, "_fbc");
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent");

  // Record the intent first so the webhook has something to reconcile against.
  const baseRow = {
    user_id: userId,
    kind: item.kind,
    item: item.id,
    credits: item.credits,
    amount: item.amount,
    currency: item.currency,
    status: "pending",
  };
  let { data: purchase, error: insErr } = await supabaseAdmin
    .from("credit_purchases")
    .insert({ ...baseRow, fbp, fbc, client_ip: clientIp, user_agent: userAgent })
    .select("id")
    .single();
  if (insErr && /fbp|fbc|client_ip|user_agent/.test(insErr.message)) {
    // The conversion-tracking migration isn't applied on this database yet —
    // never block a sale on optional ad-attribution columns.
    ({ data: purchase, error: insErr } = await supabaseAdmin
      .from("credit_purchases")
      .insert(baseRow)
      .select("id")
      .single());
  }
  if (insErr || !purchase) {
    console.error("[checkout] purchase insert failed:", insErr?.message);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  try {
    const session = await createEmbeddedCheckout({
      item,
      purchaseId: purchase.id,
      userId,
      customerId,
      origin,
      // Guests return to /subscribe/complete, which signs them into the
      // account their payment just created; signed-in buyers return to /app.
      returnPath: isGuest ? "/subscribe/complete" : "/app",
    });
    return NextResponse.json({
      provider: "stripe",
      purchaseId: purchase.id,
      clientSecret: session.clientSecret,
    });
  } catch (e) {
    await supabaseAdmin.from("credit_purchases").update({ status: "failed" }).eq("id", purchase.id);
    console.error("[checkout] Stripe session creation failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }
}
