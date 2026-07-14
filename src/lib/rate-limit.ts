import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Per-user, per-route hourly rate limits backed by the consume_rate_limit RPC
// (see supabase/migrations/20260714200000_launch_hardening.sql). The RPC is
// SECURITY DEFINER but scoped to auth.uid(), so it must be called with the
// caller's own client — each route already builds one from the bearer token.
//
// Fail-open by design: if the RPC isn't deployed yet (or the check itself
// errors), the request is allowed — the limiter hardens the routes, it must
// never take the product down.

export async function allowRequest(
  sb: SupabaseClient,
  bucket: string,
  maxPerHour: number,
): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("consume_rate_limit", {
      p_bucket: bucket,
      p_max: maxPerHour,
    });
    if (error) {
      // Missing function (migration not applied yet) or transient failure.
      console.warn(`[rate-limit] ${bucket}: ${error.message} — allowing`);
      return true;
    }
    return data === true;
  } catch {
    return true;
  }
}

/** Friendly 429 body shared by the LLM routes. */
export const RATE_LIMIT_MESSAGE =
  "You’re moving fast — this action is limited per hour. Take a short break and try again.";
