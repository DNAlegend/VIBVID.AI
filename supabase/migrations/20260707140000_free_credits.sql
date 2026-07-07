-- Free plan = 1 video / month. New signups start with 120 credits
-- (≈ one 5-second Mak Pro video, with a little headroom).
alter table public.profiles alter column credits set default 120;
