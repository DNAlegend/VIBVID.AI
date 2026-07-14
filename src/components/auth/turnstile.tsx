"use client";

// Cloudflare Turnstile widget, env-gated: renders (and gates sign-in) only
// when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so the app works unchanged
// until the key exists. Pair with Supabase Auth → Attack protection →
// captcha = Turnstile, which makes signInWithOtp REQUIRE the token.
//
// Tokens are single-use: bump `resetKey` after every send to mint a new one.

import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

export const captchaEnabled = Boolean(SITE_KEY);

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function Turnstile({
  onToken,
  resetKey = 0,
}: {
  /** Called with a fresh token, or null when the token expires. */
  onToken: (token: string | null) => void;
  /** Bump to force a fresh challenge (tokens are single-use). */
  resetKey?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY || !holder.current) return;
    let widgetId: string | null = null;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile || !holder.current) return;
        holder.current.innerHTML = "";
        widgetId = window.turnstile.render(holder.current, {
          sitekey: SITE_KEY,
          theme: "light",
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => {
        // Script unreachable — leave the widget empty; the send button stays
        // disabled and the user can reload. Never crash the auth form.
        if (!cancelled) onToken(null);
      });
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return <div ref={holder} className="mt-3 flex justify-center" />;
}
