"use client";

// Client-side Paddle.js loader + checkout opener. Paddle hosts the payment
// overlay (Paddle is our merchant of record), so we never touch card data — we
// hand Paddle a price id + the buyer's email + our purchase id, open the
// overlay, and let our webhook grant credits once the transaction completes.

const PADDLE_JS = "https://cdn.paddle.com/paddle/v2/paddle.js";

interface PaddleGlobal {
  Environment: { set: (env: "sandbox" | "production") => void };
  Initialize: (opts: { token: string; eventCallback?: (e: PaddleEvent) => void }) => void;
  Checkout: { open: (opts: Record<string, unknown>) => void };
}
interface PaddleEvent {
  name?: string;
  data?: unknown;
}
declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

let scriptPromise: Promise<PaddleGlobal> | null = null;
let initializedFor: string | null = null;
// The resolver for the checkout that's currently open. The eventCallback is
// registered once (at Initialize) but must settle whichever checkout is live,
// so it reads this rather than closing over a single promise's resolve.
let activeResolve: ((paid: boolean) => void) | null = null;

function settleActive(paid: boolean) {
  const r = activeResolve;
  activeResolve = null;
  r?.(paid);
}

function loadPaddle(): Promise<PaddleGlobal> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<PaddleGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PADDLE_JS}"]`);
    const onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error("Paddle failed to load")));
    if (existing) {
      existing.addEventListener("load", onload, { once: true });
      existing.addEventListener("error", () => reject(new Error("Paddle failed to load")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = PADDLE_JS;
    s.async = true;
    s.onload = onload;
    s.onerror = () => reject(new Error("Paddle failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface PaddleStart {
  provider: "paddle";
  purchaseId: string;
  priceId: string;
  clientToken: string;
  environment: "sandbox" | "production";
  email?: string | null;
}

/**
 * Open the Paddle checkout overlay for a started purchase. Resolves `true` when
 * the payment completes, `false` when the buyer closes the overlay without
 * paying. Credits are granted server-side by the Paddle webhook, not here.
 */
export function openPaddleCheckout(start: PaddleStart): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    // If a previous overlay is somehow still tracked, treat this open as a fresh
    // one: abandon the stale resolver so it can't settle this promise.
    activeResolve = resolve;
    loadPaddle()
      .then((Paddle) => {
        // (Re)initialise if the token changed; eventCallback settles the live checkout.
        if (initializedFor !== start.clientToken) {
          Paddle.Environment.set(start.environment);
          Paddle.Initialize({
            token: start.clientToken,
            eventCallback: (e) => {
              if (e.name === "checkout.completed") settleActive(true);
              else if (e.name === "checkout.closed") settleActive(false);
            },
          });
          initializedFor = start.clientToken;
        }
        Paddle.Checkout.open({
          items: [{ priceId: start.priceId, quantity: 1 }],
          ...(start.email ? { customer: { email: start.email } } : {}),
          customData: { purchase_id: start.purchaseId },
          settings: { displayMode: "overlay", theme: "dark" },
        });
      })
      .catch((err) => {
        if (activeResolve === resolve) activeResolve = null;
        reject(err);
      });
  });
}
