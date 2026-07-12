-- Paid only, no trial: new accounts start with zero credits — the MamoPay
-- webhook deposits the plan's credits after the first successful payment.
alter table public.profiles alter column credits set default 0;
