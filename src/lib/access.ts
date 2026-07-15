import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Who may use the paid studio features (script writing, generation). New
// accounts can sign up for free and land in the app, but the app stays locked
// until they subscribe — this is the server-side half of that gate, so a free
// account can't reach the paid endpoints directly (bypassing the locked UI).
//
// The entitlement is "holds credits" (or is an owner). Credits arrive only from
// a subscription (the webhook grants them), so a never-paid account has zero
// and is blocked, while a subscriber who has spent down to zero is blocked from
// the unmetered LLM routes until they top up or renew — which is fine, they
// can't generate at zero either. This is the same signal the client unlocks on,
// so server and UI never disagree.

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "abuaisha.hussin@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * True if the caller may use paid features. Reads the caller's own credit
 * balance with their RLS-scoped client. Fails CLOSED on a lookup error — this
 * gate guards our token spend, so a transient failure must not hand a free
 * account access (contrast the watermark check, which fails toward paid).
 */
export async function hasStudioAccess(
  sb: SupabaseClient,
  userId: string,
  email: string | null | undefined,
): Promise<boolean> {
  if (email && adminEmails().includes(email.toLowerCase())) return true;
  const { data, error } = await sb.from("profiles").select("credits").eq("id", userId).maybeSingle();
  if (error) return false;
  return (data?.credits ?? 0) > 0;
}

/** Friendly 402 message when the studio isn't activated yet. */
export const ACTIVATE_MESSAGE = "Subscribe to a plan to start creating.";
