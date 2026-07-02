// Supabase browser client. Null when env isn't configured — the app then
// runs in local demo mode (localStorage only), exactly as before.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

/** True when the app is built with Supabase credentials. */
export const cloudConfigured = !!supabase;
