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

/**
 * Create-or-fetch a user for an email address, for guest checkout: the buyer
 * pays first and confirms the account afterwards (via the magic link the app
 * sends when they return from payment). No email is sent from here.
 */
export async function userIdForEmail(email: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const created = await supabaseAdmin.auth.admin.createUser({ email });
  if (created.data.user) return created.data.user.id;
  // Already registered — generateLink is the admin API that returns the
  // existing user by email (the link itself is discarded, nothing is sent).
  const existing = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  return existing.data.user?.id ?? null;
}
