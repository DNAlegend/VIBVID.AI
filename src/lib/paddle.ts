import "server-only";
import crypto from "node:crypto";

// Paddle (Billing) server helper. Paddle is our merchant of record — it hosts
// the checkout, collects payment and tax, and calls our webhook when a
// transaction completes. Docs: https://developer.paddle.com
//
// Config (set in the environment / Vercel):
//   PADDLE_ENV               "sandbox" (default) or "production"
//   PADDLE_API_KEY           server-side API key (secret)          — server only
//   PADDLE_WEBHOOK_SECRET    notification-destination secret (whsec_…)
//   NEXT_PUBLIC_PADDLE_CLIENT_TOKEN   client-side token used by Paddle.js
//   PADDLE_PRICE_<ITEM>      Paddle price id (pri_…) for each billing item,
//                            e.g. PADDLE_PRICE_PLAN_PRO, PADDLE_PRICE_TOPUP_600
//
// The price-id map lives on the server so a browser can never swap in a
// cheaper price: the client sends only our internal item id, we resolve the
// Paddle price id here, and the webhook re-checks the amount before crediting.

export function paddleEnvironment(): "sandbox" | "production" {
  return process.env.PADDLE_ENV === "production" ? "production" : "sandbox";
}

/** True once the pieces needed to open a Paddle checkout are present. */
export function paddleConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN && !!paddleAnyPriceConfigured();
}

export function paddleClientToken(): string {
  return process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
}

/** Env var name holding the Paddle price id for a given billing item id. */
function priceEnvKey(itemId: string): string {
  // "plan-pro" -> "PADDLE_PRICE_PLAN_PRO", "topup-600" -> "PADDLE_PRICE_TOPUP_600"
  return `PADDLE_PRICE_${itemId.toUpperCase().replace(/-/g, "_")}`;
}

/** Resolve the Paddle price id (pri_…) for one of our billing items, or null. */
export function priceIdForItem(itemId: string): string | null {
  const v = process.env[priceEnvKey(itemId)];
  return v && v.trim() ? v.trim() : null;
}

function paddleAnyPriceConfigured(): boolean {
  return Object.keys(process.env).some((k) => k.startsWith("PADDLE_PRICE_") && process.env[k]);
}

/**
 * Verify a Paddle webhook signature. Paddle signs the *raw* request body:
 * the `Paddle-Signature` header is `ts=<unix>;h1=<hex hmac>` and h1 =
 * HMAC-SHA256(`${ts}:${rawBody}`) keyed with the webhook secret. We compare in
 * constant time. Returns false (rather than throwing) on any malformed input.
 */
export function verifyPaddleSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(";").map((kv) => {
      const [k, ...rest] = kv.split("=");
      return [k.trim(), rest.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(h1, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/** Paddle marks a fully-paid transaction as "completed" (or "paid"). */
export function transactionSucceeded(status?: string): boolean {
  return status === "completed" || status === "paid";
}
