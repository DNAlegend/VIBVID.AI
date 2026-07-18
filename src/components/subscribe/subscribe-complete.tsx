"use client";

// The landing strip of pay-first onboarding: Stripe's Embedded Checkout
// returns the guest buyer here after payment. We exchange the checkout
// session id for a one-time login token (/api/checkout/complete verifies
// the payment with Stripe server-side), redeem it into a real session, and
// glide into the studio — where the ?purchase=success handler polls the
// webhook's credits in and fires the conversion pixels.
//
// Any failure degrades safely: the payment is already captured and credited
// by the webhook, so the fallback is simply "log in with this email".

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui";
import { LogoWordmark } from "@/components/logo";

function SubscribeCompleteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<"working" | "login" | "failed">("working");
  const [email, setEmail] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const sessionId = params.get("session_id");
    // Conversion + activation params ride through into the app.
    const forward = new URLSearchParams({
      purchase: "success",
      purchase_id: params.get("purchase_id") ?? "",
      kind: params.get("kind") ?? "",
      amount: params.get("amount") ?? "",
      currency: params.get("currency") ?? "",
    });

    (async () => {
      if (!sessionId || !supabase) {
        setState("login");
        return;
      }
      try {
        const res = await fetch("/api/checkout/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (typeof data.email === "string") setEmail(data.email);

        if (res.ok && typeof data.tokenHash === "string") {
          const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: data.tokenHash });
          if (!error) {
            router.replace(`/app?${forward.toString()}`);
            return;
          }
        }
        // Paid but no auto-login (established account, replay, expired token…)
        // — the account and credits are safe; OTP login is the way in. A 402
        // (session not actually paid) gets the neutral copy, not "received".
        setState(res.ok ? "login" : "failed");
      } catch {
        setState("failed");
      }
    })();
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <LogoWordmark className="text-2xl" />
        </div>

        {state === "working" && (
          <>
            <Loader2 size={26} className="mx-auto mt-8 animate-spin text-accent-2" />
            <h1 className="font-display mt-4 text-2xl font-bold tracking-tight">Setting up your studio…</h1>
            <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-muted">
              Payment received — creating your account and signing you in.
            </p>
          </>
        )}

        {state !== "working" && (
          <>
            <span className="mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-2">
              <Mail size={26} />
            </span>
            <h1 className="font-display mt-4 text-2xl font-bold tracking-tight">
              {state === "login" ? "Payment received — log in to enter" : "Almost there"}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-muted">
              {state === "login" ? (
                <>
                  Your studio is ready{email ? (
                    <>
                      {" "}under <span className="font-semibold text-fg">{email}</span>
                    </>
                  ) : null}
                  . Log in with a one-time email code and you're in.
                </>
              ) : (
                <>
                  If your payment went through, your account and credits are safe — log in with the
                  email you used to check out. Otherwise email support@vibvid.ai.
                </>
              )}
            </p>
            <Link href="/app">
              <Button size="lg" className="mt-6 w-full">
                Log in to your studio <ArrowRight size={17} />
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export function SubscribeComplete() {
  return (
    <Suspense fallback={null}>
      <SubscribeCompleteInner />
    </Suspense>
  );
}
