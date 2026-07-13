-- Free tier at launch: new accounts start with 20 credits (enough to try the
-- studio, watermarked). Supersedes the paid-only default of 0. Paid plans still
-- deposit their monthly credits via the MamoPay webhook on top of this.
alter table public.profiles alter column credits set default 20;
