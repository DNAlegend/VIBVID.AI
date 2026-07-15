-- Stripe era, paid only: no free tier, no trial. New accounts start with zero
-- credits — the Stripe webhook deposits the plan's credits after the first
-- successful payment. Supersedes the 20-credit free-tier default.
alter table public.profiles alter column credits set default 0;
