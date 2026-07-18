import "server-only";

// Server-side Supabase client using the secret key — bypasses RLS.
// For API routes only (e.g. the generation endpoint: verify the caller's JWT,
// spend credits, write the generation row). Importing this from client code
// fails the build via the "server-only" package guard.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export const supabaseAdmin: SupabaseClient | null =
  url && secretKey
    ? createClient(url, secretKey, { auth: { persistSession: false } })
    : null;

/**
 * Resolve the user id for a request's `Authorization: Bearer <access token>`
 * header, or null when missing/invalid. API routes use this to authenticate
 * the caller before acting with admin privileges.
 */
export async function userIdFromRequest(req: Request): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user?.id ?? null;
}

/** The minimal auth-user shape the established-account check reads. */
interface AuthUserLite {
  id: string;
  last_sign_in_at?: string | null;
  user_metadata?: { guest_activated?: boolean } | null;
}

/**
 * Is this account ESTABLISHED — i.e. must it log in rather than be handed a
 * session by the pay-first flow? True if it has ever signed in, has already
 * been activated once by guest checkout, or has real value behind it (a paid
 * purchase or a positive credit balance). A shell account left by an
 * abandoned guest checkout (created but never used, never paid, no credits)
 * is NOT established — the same buyer may come back and finish.
 *
 * This is the ONE definition both the guest-checkout gate and the guest
 * auto-login (/api/checkout/complete) must share — any mismatch is an
 * account-takeover hole (a paid-but-not-yet-signed-in account could be
 * handed to whoever replays the checkout session id).
 */
export async function isEstablishedAccount(user: AuthUserLite): Promise<boolean> {
  if (!supabaseAdmin) return true; // fail closed
  if (user.last_sign_in_at) return true;
  if (user.user_metadata?.guest_activated) return true;
  const { data: paid } = await supabaseAdmin
    .from("credit_purchases")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  if ((paid?.length ?? 0) > 0) return true;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .maybeSingle();
  return (profile?.credits ?? 0) > 0;
}

/**
 * Guest checkout resolution for an email — pay first, account after. The
 * pay-before-login path may be used ONCE per email; an established account
 * (see isEstablishedAccount) must log in and subscribe inside the app.
 *
 * Returns `{ userId }` when guest checkout may proceed (creating the account
 * if needed), or `{ exists: true }` when the email must log in. No email is
 * ever sent from here.
 */
export async function guestUserForEmail(
  email: string,
): Promise<{ userId: string; exists?: never } | { exists: true; userId?: never } | null> {
  if (!supabaseAdmin) return null;
  const created = await supabaseAdmin.auth.admin.createUser({ email });
  if (created.data.user) return { userId: created.data.user.id };

  // Already registered — generateLink is the admin API that returns the
  // existing user by email (the link itself is discarded, nothing is sent).
  const existing = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  const user = existing.data.user;
  if (!user) return null;
  if (await isEstablishedAccount(user)) return { exists: true };
  return { userId: user.id };
}
