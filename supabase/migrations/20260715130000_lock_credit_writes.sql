-- Lock down credit writes. With no free tier, credits are the paywall — so no
-- client-reachable path may ever ADD credits. Before this migration a signed-in
-- user could mint credits two ways:
--   1. adjust_credits(delta) accepted any positive delta, and
--   2. the profiles UPDATE policy wasn't column-restricted, so
--      update profiles set credits = … went straight through PostgREST.
-- Grants now flow only through SECURITY DEFINER server paths: settle_charge
-- (Stripe webhook), settle_render_failure (atomic failed-render refund), and
-- grant_credits below (service-role refunds in /api/generate).

-- 1. adjust_credits: spends (and a delta-0 balance read) only ----------------
-- Same signature and return contract (new balance, or null when the spend
-- would go negative — and now also null for any positive delta).
create or replace function public.adjust_credits(delta integer) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if auth.uid() is null or delta > 0 then
    return null; -- grants are server-side only
  end if;
  update public.profiles
     set credits = credits + delta, updated_at = now()
   where id = auth.uid() and credits + delta >= 0
  returning credits into v_balance;
  return v_balance;
end;
$$;
revoke all on function public.adjust_credits(integer) from public, anon;
grant execute on function public.adjust_credits(integer) to authenticated;

-- 2. Service-role refunds ----------------------------------------------------
-- /api/generate refunds a failed render's cost through the admin client.
create or replace function public.grant_credits(p_user uuid, p_delta integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set credits = credits + p_delta, updated_at = now()
   where id = p_user and p_delta > 0;
$$;
revoke all on function public.grant_credits(uuid, integer) from public, anon, authenticated;
grant execute on function public.grant_credits(uuid, integer) to service_role;

-- 3. Clients may update nothing on profiles except their ToS acceptance ------
revoke update on table public.profiles from anon, authenticated;
grant update (accepted_terms_at) on public.profiles to authenticated;
