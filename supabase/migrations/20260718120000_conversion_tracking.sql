-- Conversion tracking: capture the match-quality signals available at
-- checkout time (Meta's browser cookies, the buyer's IP/UA) so the Stripe
-- webhook can later report an accurate server-side "Subscribe" event via
-- Meta's Conversions API — without ever trusting the client for anything
-- that affects credits or billing. Purely additive; existing rows just get
-- nulls here.

alter table public.credit_purchases
  add column if not exists fbp text,
  add column if not exists fbc text,
  add column if not exists client_ip text,
  add column if not exists user_agent text;

comment on column public.credit_purchases.fbp is 'Meta browser pixel cookie (_fbp) captured at checkout, for Conversions API match quality.';
comment on column public.credit_purchases.fbc is 'Meta click-id cookie (_fbc) captured at checkout, for Conversions API match quality.';
comment on column public.credit_purchases.client_ip is 'Buyer IP at checkout time, for Conversions API match quality.';
comment on column public.credit_purchases.user_agent is 'Buyer user agent at checkout time, for Conversions API match quality.';
