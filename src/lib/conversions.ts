"use client";

// Browser-side half of conversion tracking — fires Google Ads' conversion
// event and Meta Pixel's "Subscribe" event the moment someone completes
// their FIRST subscription checkout (never on renewals or credit top-ups,
// since those never land here — see app-shell.tsx's ?purchase=success
// handling). The server-side Meta Conversions API call in the Stripe
// webhook reports the same event independently for reliability; the two
// share one event id so Meta dedupes them.
//
// Every call is a no-op if the corresponding tag isn't configured, and each
// purchase fires at most once (tracked in localStorage) even across reloads.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

const FIRED_KEY = "vibvid-conversions-fired";

function alreadyFired(purchaseId: string): boolean {
  try {
    const fired: string[] = JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]");
    return fired.includes(purchaseId);
  } catch {
    return false;
  }
}

function markFired(purchaseId: string): void {
  try {
    const fired: string[] = JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]");
    localStorage.setItem(FIRED_KEY, JSON.stringify([...fired, purchaseId].slice(-50)));
  } catch {
    /* localStorage unavailable — worst case a refresh could refire once */
  }
}

/**
 * Report "this account just became a paid subscriber" to every configured
 * ad platform. `purchaseId` doubles as the dedup key (localStorage) and the
 * Meta event_id shared with the server-side Conversions API call.
 */
export function trackSubscribeConversion(opts: { purchaseId: string; value: number; currency: string }): void {
  const { purchaseId, value, currency } = opts;
  if (!purchaseId || alreadyFired(purchaseId)) return;
  markFired(purchaseId);

  const googleId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const googleLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;
  if (googleId && googleLabel && window.gtag) {
    window.gtag("event", "conversion", {
      send_to: `${googleId}/${googleLabel}`,
      value,
      currency,
      transaction_id: purchaseId,
    });
  }

  if (process.env.NEXT_PUBLIC_META_PIXEL_ID && window.fbq) {
    window.fbq("track", "Subscribe", { value, currency }, { eventID: purchaseId });
  }
}
