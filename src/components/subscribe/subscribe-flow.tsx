"use client";

// Pay-first onboarding — the smoothest possible path from the landing page
// into the studio: pick a plan → enter an email → pay. That's it. The
// account is created server-side around the payment; /subscribe/complete
// signs the buyer straight in afterwards (no OTP on the very first entry —
// next visits use the normal email code).
//
// The guest path is one-time per email: an address that already has an
// established account is bounced to log in and subscribe inside the app.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, Loader2, Lock, Mail, UserRound } from "lucide-react";
import { PLAN_ITEMS, planVariant, type BillingItem } from "@/lib/billing";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Badge, Button, TextInput } from "@/components/ui";
import { CheckoutPanel } from "@/components/checkout/checkout-panel";
import { LogoWordmark } from "@/components/logo";

type Step = "plan" | "email" | "pay" | "login";

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ["plan", "email", "pay"];
  const idx = Math.max(0, order.indexOf(step));
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {["Plan", "Email", "Pay"].map((label, i) => (
        <span key={label} className="flex items-center gap-2">
          {i > 0 && <span className={cn("h-px w-8", i <= idx ? "bg-accent" : "bg-line-2")} />}
          <span
            className={cn(
              "flex items-center gap-1.5 text-[12px] font-semibold",
              i === idx ? "text-accent-2" : i < idx ? "text-teal" : "text-faint",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                i < idx
                  ? "border-teal bg-teal text-white"
                  : i === idx
                    ? "border-accent bg-accent text-white"
                    : "border-line-2",
              )}
            >
              {i < idx ? <Check size={11} /> : i + 1}
            </span>
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}

function SubscribeFlowInner() {
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("plan");
  const [cycle, setCycle] = useState<"month" | "year">("month");
  const [selectedId, setSelectedId] = useState(PLAN_ITEMS.find((p) => p.popular)?.id ?? PLAN_ITEMS[0].id);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Already signed in? The guest flow (pay-first, account-after) isn't for
  // you — subscribing happens inside the app against your real account. Bounce
  // to /app with the chosen plan preselected so the app's own paywall handles
  // it; this avoids creating a second account and a silent session swap.
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      const wanted = params.get("plan");
      window.location.replace(`/app${wanted ? `?buy=${wanted}` : ""}`);
    });
  }, [params]);

  // ?plan=plan-pro or ?plan=plan-pro-year — preselect from the landing CTA.
  useEffect(() => {
    const wanted = params.get("plan");
    if (!wanted) return;
    const base = wanted.replace(/-year$/, "");
    if (PLAN_ITEMS.some((p) => p.id === base)) {
      setSelectedId(base);
      if (/-year$/.test(wanted)) setCycle("year");
    }
  }, [params]);

  const baseMonthly = PLAN_ITEMS.find((p) => p.id === selectedId) ?? PLAN_ITEMS[0];
  const paid: BillingItem = (cycle === "year" ? planVariant(baseMonthly.id, "year") : null) ?? baseMonthly;
  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  /** Email → checkout session. 409 = the email must log in instead. */
  async function startCheckout() {
    if (busy || !emailValid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: paid.id, email: email.trim().toLowerCase(), origin: window.location.origin }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.code === "account_exists") {
        setStep("login");
        return;
      }
      if (res.status === 501) {
        setError("Payments aren't configured on this server yet — try again later.");
        return;
      }
      if (!res.ok || typeof data.clientSecret !== "string") {
        throw new Error(data.error ?? "Could not start checkout");
      }
      setClientSecret(data.clientSecret);
      setStep("pay");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <LogoWordmark />
          </Link>
          <Link href="/app" className="text-[13px] font-medium text-muted transition-colors hover:text-fg">
            Already have an account? <span className="text-accent-2">Log in</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        {step !== "login" && <StepDots step={step} />}

        {/* ------------------------------- Plan ------------------------------- */}
        {step === "plan" && (
          <div>
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Pick your plan</h1>
              <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-muted">
                Subscribe, pay, and you're in the studio — under a minute. Cancel anytime.
              </p>
            </div>

            <div className="mt-5 flex justify-center">
              <div className="inline-flex rounded-full border border-line bg-surface p-0.5 text-[12.5px] font-medium">
                <button
                  onClick={() => setCycle("month")}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 transition-colors",
                    cycle === "month" ? "bg-accent text-white" : "text-muted hover:text-fg",
                  )}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setCycle("year")}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 transition-colors",
                    cycle === "year" ? "bg-accent text-white" : "text-muted hover:text-fg",
                  )}
                >
                  Annual · 4 months on us
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {PLAN_ITEMS.map((base) => {
                const p = (cycle === "year" ? planVariant(base.id, "year") : null) ?? base;
                const active = selectedId === base.id;
                return (
                  <button
                    key={base.id}
                    onClick={() => setSelectedId(base.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl border bg-surface p-4 text-left transition-colors",
                      active ? "border-accent ring-1 ring-accent/40" : "border-line hover:border-faint",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full border",
                          active ? "border-accent" : "border-line-2",
                        )}
                      >
                        {active && <span className="h-2 w-2 rounded-full bg-accent" />}
                      </span>
                      <span>
                        <span className="flex items-center gap-2 text-[15px] font-semibold text-fg">
                          {p.label}
                          {"popular" in p && p.popular && <Badge tone="accent">Most popular</Badge>}
                        </span>
                        <span className="block text-[12.5px] text-faint">
                          {cycle === "year" ? p.sublabel : `${p.credits.toLocaleString()} credits / mo · ${p.sublabel}`}
                        </span>
                      </span>
                    </span>
                    <span className="text-lg font-bold text-fg">
                      {p.priceLabel}
                      <span className="text-xs font-normal text-faint">{cycle === "year" ? "/yr" : "/mo"}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <Button size="lg" className="mt-4 w-full" onClick={() => setStep("email")}>
              Next <ArrowRight size={17} />
            </Button>
          </div>
        )}

        {/* ------------------------------ Email ------------------------------ */}
        {step === "email" && (
          <div>
            <div className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-2">
                <Mail size={22} />
              </span>
              <h1 className="font-display mt-4 text-2xl font-bold tracking-tight">Where do we send your studio?</h1>
              <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-muted">
                Your email becomes your account the moment payment clears — receipts and sign-in
                codes go here too.
              </p>
            </div>

            <div className="mt-6">
              <label className="mb-1.5 block text-[13px] font-medium text-fg">Email</label>
              <TextInput
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startCheckout()}
              />
            </div>

            <div className="mt-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px]">
              <span className="flex items-center justify-between">
                <span className="text-muted">
                  {paid.label} · {cycle === "year" ? "annual" : "monthly"}
                </span>
                <span className="font-semibold">
                  {paid.priceLabel}
                  <span className="text-xs font-normal text-faint">{cycle === "year" ? "/yr" : "/mo"}</span>
                </span>
              </span>
            </div>

            <Button size="lg" className="mt-4 w-full" onClick={startCheckout} disabled={busy || !emailValid}>
              {busy ? <Loader2 size={17} className="animate-spin" /> : <>Next — payment <ArrowRight size={17} /></>}
            </Button>
            {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
            <p className="mt-4 text-center text-[12px] text-faint">
              By continuing you agree to the{" "}
              <Link href="/terms" className="underline hover:text-fg">Terms of Service</Link> and{" "}
              <Link href="/privacy" className="underline hover:text-fg">Privacy Policy</Link>.
            </p>
            <button
              onClick={() => setStep("plan")}
              className="mx-auto mt-4 block text-[12.5px] font-medium text-muted transition-colors hover:text-fg"
            >
              ← Change plan
            </button>
          </div>
        )}

        {/* ------------------------------- Pay ------------------------------- */}
        {step === "pay" && clientSecret && (
          <div>
            <CheckoutPanel
              clientSecret={clientSecret}
              onBack={() => {
                // A checkout session is single-shot — changing email/plan mints a new one.
                setClientSecret(null);
                setStep("email");
              }}
            />
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-faint">
              <Lock size={12} /> Secure checkout by Stripe · pay, and you're in the studio.
            </p>
          </div>
        )}

        {/* --------------------- Existing account — log in -------------------- */}
        {step === "login" && (
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-2">
              <UserRound size={22} />
            </span>
            <h1 className="font-display mt-4 text-2xl font-bold tracking-tight">You already have an account</h1>
            <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-muted">
              <span className="font-semibold text-fg">{email.trim()}</span> is already registered.
              Log in with a one-time code and subscribe right inside your studio.
            </p>
            {/* Carry the chosen plan through login so the paywall preselects it. */}
            <Link href={`/app?buy=${paid.id}`}>
              <Button size="lg" className="mt-5 w-full">
                Log in to subscribe <ArrowRight size={17} />
              </Button>
            </Link>
            <button
              onClick={() => setStep("email")}
              className="mx-auto mt-4 block text-[12.5px] font-medium text-muted transition-colors hover:text-fg"
            >
              ← Use a different email
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export function SubscribeFlow() {
  return (
    <Suspense fallback={null}>
      <SubscribeFlowInner />
    </Suspense>
  );
}
