-- IP-based rate limiting for the UNAUTHENTICATED guest-checkout path.
-- The existing consume_rate_limit is scoped to auth.uid(), so it can't cover
-- a route with no session. This keyed variant is called by the service role
-- from /api/checkout to cap account/customer/purchase-row creation (and email
-- enumeration) per client IP per hour. Fail-open in the app layer, same as the
-- authenticated limiter.

create table if not exists public.guest_rate_limits (
  key text not null,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, bucket, window_start)
);
alter table public.guest_rate_limits enable row level security;
-- No policies: only the SECURITY DEFINER RPC below (and the service role) touch it.

create or replace function public.consume_guest_rate_limit(p_key text, p_bucket text, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if p_key is null or length(p_key) = 0 then
    return true; -- no key to limit on — don't block (fail open)
  end if;
  insert into public.guest_rate_limits (key, bucket, window_start, count)
  values (p_key, p_bucket, v_window, 1)
  on conflict (key, bucket, window_start)
  do update set count = public.guest_rate_limits.count + 1
  returning count into v_count;
  delete from public.guest_rate_limits
  where key = p_key and bucket = p_bucket and window_start < v_window - interval '2 hours';
  return v_count <= p_max;
end;
$$;

-- Callable only by the service role (the checkout route's admin client).
revoke all on function public.consume_guest_rate_limit(text, text, integer) from public, anon, authenticated;
grant execute on function public.consume_guest_rate_limit(text, text, integer) to service_role;
