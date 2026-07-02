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
