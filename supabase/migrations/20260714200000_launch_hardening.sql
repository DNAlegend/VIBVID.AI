-- Launch hardening: per-user rate limits for the LLM routes, ToS acceptance
-- timestamp, and an atomic settle for failed renders (flip + refund in one
-- transaction, closing the serverless-kill refund-loss window).

-- 1. Fixed-hourly-window rate limiter -------------------------------------------
-- One row per (user, bucket, hour window). SECURITY DEFINER, but hard-scoped to
-- auth.uid() — callers can only ever consume their own quota.
create table if not exists public.rate_limits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket, window_start)
);
alter table public.rate_limits enable row level security;
-- No policies: only the RPC below (and service role) touches it.

create or replace function public.consume_rate_limit(p_bucket text, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if v_user is null then
    return false;
  end if;
  insert into public.rate_limits (user_id, bucket, window_start, count)
  values (v_user, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;
  -- Opportunistic cleanup of old windows for this user+bucket.
  delete from public.rate_limits
  where user_id = v_user and bucket = p_bucket and window_start < v_window - interval '2 hours';
  return v_count <= p_max;
end;
$$;
revoke all on function public.consume_rate_limit(text, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer) to authenticated;

-- 2. Terms-of-service acceptance --------------------------------------------
alter table public.profiles
  add column if not exists accepted_terms_at timestamptz;

-- Owners may stamp their own acceptance (once; later writes just overwrite
-- with a fresh timestamp, which is fine — latest acceptance wins).
-- profiles UPDATE policy already exists for own row; no new policy needed.

-- 3. Atomic failed-render settle --------------------------------------------
-- Flips a generation rendering→failed AND refunds its cost in one transaction.
-- Returns true only when this call performed the flip (and hence the refund),
-- so concurrent pollers can never double-refund and a crash can't lose one.
create or replace function public.settle_render_failure(p_id text, p_error text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cost integer;
begin
  if v_user is null then
    return false;
  end if;
  update public.generations
     set status = 'failed', progress = 100, error = left(coalesce(p_error, 'failed'), 300)
   where id = p_id and user_id = v_user and status = 'rendering'
  returning credits_cost into v_cost;
  if not found then
    return false; -- someone else settled it (or it isn't rendering)
  end if;
  update public.profiles
     set credits = credits + coalesce(v_cost, 0)
   where id = v_user;
  return true;
end;
$$;
revoke all on function public.settle_render_failure(text, text) from public, anon;
grant execute on function public.settle_render_failure(text, text) to authenticated;
