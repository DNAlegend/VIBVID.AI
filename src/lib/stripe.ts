import "server-only";
import Stripe from "stripe";
import type { BillingItem } from "@/lib/billing";

// Stripe — our payment processor (TAXNOW FZE account). We create Checkout
// Sessions server-side with inline price_data priced from the billing catalog
// (so a browser can never swap in a cheaper amount), redirect the buyer to
// Stripe's hosted checkout, and grant credits from the webhook once Stripe
// reports the payment. We never touch card data.
//
// Config (set in Vercel, Production + Preview):
//   STRIPE_SECRET_KEY      secret API key (Dashboard → Developers → API keys) — server only
//   STRIPE_WEBHOOK_SECRET  signing secret of the webhook endpoint pointing at
//                          /api/stripe/webhook (Dashboard → Developers → Webhooks)

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
  return client;
}

/**
 * Create a hosted Stripe Checkout Session for one billing item and return its
 * URL. Subscriptions run in `subscription` mode with a recurring inline price
 * (monthly or yearly per the catalog); top-ups run in one-off `payment` mode.
 * The purchase id travels in the session metadata AND the subscription
 * metadata, so the webhook can tie the first charge and every renewal invoice
 * back to the pending purchase row.
 */
export async function createStripeCheckout(opts: {
  item: BillingItem;
  purchaseId: string;
  userId: string;
  origin: string;
  email?: string | null;
}): Promise<{ id: string; url: string }> {
  const { item, purchaseId, userId, origin, email } = opts;
  const isSubscription = item.kind === "subscription";
  const interval = item.interval ?? "month";
  const meta = { purchase_id: purchaseId, user_id: userId, item_id: item.id };

  const session = await stripe().checkout.sessions.create({
    mode: isSubscription ? "subscription" : "payment",
    client_reference_id: purchaseId,
    ...(email ? { customer_email: email } : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: item.currency.toLowerCase(),
          unit_amount: Math.round(item.amount * 100),
          ...(isSubscription ? { recurring: { interval } } : {}),
          product_data: {
            name: `VIBVID ${item.label}`,
            description: `${item.credits.toLocaleString()} credits${
              isSubscription ? (interval === "year" ? " / year" : " / month") : ""
            }`,
          },
        },
      },
    ],
    metadata: meta,
    ...(isSubscription ? { subscription_data: { metadata: meta } } : {}),
    success_url: `${origin}/app?purchase=success`,
    cancel_url: `${origin}/app?purchase=failed`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { id: session.id, url: session.url };
}

/**
 * Verify a Stripe webhook delivery against the endpoint's signing secret.
 * Returns the parsed event, or null on any missing/invalid signature —
 * callers reject with 401 rather than throwing.
 */
export function verifyStripeWebhook(rawBody: string, signature: string | null): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return null;
  try {
    return stripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return null;
  }
}

/**
 * Pull our metadata off a subscription invoice. Stripe has moved this shape
 * across API versions (top-level `subscription_details` vs `parent.…`), so we
 * check both and finally fall back to retrieving the subscription itself.
 */
export async function invoicePurchaseMetadata(
  invoice: Stripe.Invoice
): Promise<Record<string, string> | null> {
  const inv = invoice as unknown as {
    parent?: { subscription_details?: { metadata?: Record<string, string>; subscription?: string | { id: string } } };
    subscription_details?: { metadata?: Record<string, string> };
    subscription?: string | { id: string };
  };
  const direct = inv.parent?.subscription_details?.metadata ?? inv.subscription_details?.metadata;
  if (direct?.purchase_id) return direct;

  const subRef = inv.parent?.subscription_details?.subscription ?? inv.subscription;
  const subId = typeof subRef === "string" ? subRef : subRef?.id;
  if (!subId) return null;
  try {
    const sub = await stripe().subscriptions.retrieve(subId);
    return sub.metadata?.purchase_id ? (sub.metadata as Record<string, string>) : null;
  } catch {
    return null;
  }
}
