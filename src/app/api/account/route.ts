// Self-serve billing for the on-site account page. Everything a customer can
// do to their subscription happens here — no Stripe-hosted portal, no redirect.
//
// GET  → billing overview (plan, renewal, card, invoices) + credit balance.
// POST → one of: cancel | resume | switch | card-setup | card-default.
//
// Every call authenticates the caller and acts only on THEIR Stripe customer.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getBillingCustomer } from "@/lib/billing-customer";
import {
  stripeConfigured,
  getBillingOverview,
  setCancelAtPeriodEnd,
  switchPlan,
  createCardSetupIntent,
  setDefaultCard,
} from "@/lib/stripe";

export const maxDuration = 20;

/** Allowlisted owner accounts — always treated as activated (see GET). */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "abuaisha.hussin@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function authed(
  req: Request,
): Promise<{ userId: string; email: string | null; customerId: string | null } | null> {
  if (!stripeConfigured() || !supabaseAdmin) return null;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  const bc = await getBillingCustomer(data.user.id);
  return { userId: data.user.id, email: data.user.email?.toLowerCase() ?? null, customerId: bc?.customerId ?? null };
}

export async function GET(req: Request) {
  const a = await authed(req);
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin!
    .from("profiles")
    .select("credits")
    .eq("id", a.userId)
    .maybeSingle();
  const credits = profile?.credits ?? 0;
  // Owners always have studio access without subscribing (the client unlocks on this).
  const admin = Boolean(a.email && adminEmails().includes(a.email));

  if (!a.customerId) {
    // No purchases yet — nothing to manage, just show the balance.
    return NextResponse.json({ credits, admin, billing: null });
  }
  try {
    const billing = await getBillingOverview(a.customerId);
    return NextResponse.json({ credits, admin, billing });
  } catch (e) {
    console.error("[account] overview failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ credits, admin, billing: null });
  }
}

export async function POST(req: Request) {
  const a = await authed(req);
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!a.customerId) return NextResponse.json({ error: "No billing account yet" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  try {
    switch (action) {
      case "cancel":
        await setCancelAtPeriodEnd(a.customerId, true);
        return NextResponse.json({ ok: true });
      case "resume":
        await setCancelAtPeriodEnd(a.customerId, false);
        return NextResponse.json({ ok: true });
      case "switch": {
        const itemId = typeof body?.itemId === "string" ? body.itemId : "";
        await switchPlan(a.customerId, a.userId, itemId);
        return NextResponse.json({ ok: true });
      }
      case "card-setup": {
        const clientSecret = await createCardSetupIntent(a.customerId);
        return NextResponse.json({ clientSecret });
      }
      case "card-default": {
        const pm = typeof body?.paymentMethodId === "string" ? body.paymentMethodId : "";
        if (!pm) return NextResponse.json({ error: "Missing payment method" }, { status: 400 });
        await setDefaultCard(a.customerId, pm);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong";
    console.error(`[account] ${action} failed:`, msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
