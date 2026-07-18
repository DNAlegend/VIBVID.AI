// Meta Conversions API — server-side reporting of the "Subscribe" event,
// sent from the Stripe webhook the instant a NEW subscription's first
// invoice is paid (never on renewals or credit top-ups). This is the
// reliable half of Meta conversion tracking: unlike the browser Pixel, it
// isn't blocked by ad blockers or hidden by iOS App Tracking Transparency.
//
// The browser Pixel (src/lib/conversions.ts) fires the SAME event with the
// SAME event_id from the client for speed/attribution; Meta dedupes the two
// automatically by (pixel_id, event_id).
//
// No-ops entirely when unconfigured — never import this from client code.

import { createHash } from "node:crypto";

const GRAPH_VERSION = "v21.0";

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function metaCapiConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN);
}

interface SubscribeEventInput {
  /** Shared with the browser Pixel call so Meta dedupes the two — the purchase id is ideal. */
  eventId: string;
  email: string | null;
  value: number;
  currency: string;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  eventSourceUrl?: string;
}

/**
 * Report a completed subscription to Meta. Fire-and-forget from the
 * webhook's point of view — errors are logged, never thrown, so a Meta API
 * hiccup can never fail (or slow down) the Stripe webhook's ack.
 */
export async function sendMetaSubscribeEvent(input: SubscribeEventInput): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) return;

  const userData: Record<string, unknown> = {};
  if (input.email) userData.em = [sha256(input.email)];
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;

  const payload = {
    data: [
      {
        event_name: "Subscribe",
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.eventSourceUrl ?? "https://vibvid.ai/app",
        user_data: userData,
        custom_data: { value: input.value, currency: input.currency },
      },
    ],
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn("[meta-capi] event rejected:", res.status, (await res.text()).slice(0, 300));
    }
  } catch (e) {
    console.warn("[meta-capi] request failed:", e instanceof Error ? e.message : e);
  }
}
