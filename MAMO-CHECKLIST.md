# MamoPay go-live checklist

VIBVID launches with **Mamo (Mamo Pay)** as its payment processor. Mamo is a
UAE payment gateway — **not** a merchant of record — so **TAXNOW (FZE) is the
seller of record** and is responsible for its own invoicing and any applicable
VAT/tax. Below is everything to do outside the code before real charges work.

> ⚠️ **Tax note:** With Paddle (the previous setup) tax was collected by the MoR.
> With Mamo, that responsibility moves to TAXNOW (FZE). Confirm your UAE VAT
> position (registration + whether prices are tax-inclusive) with your
> accountant. The site copy now says prices are "exclusive of any applicable
> taxes" and names TAXNOW as seller of record.

## 1. Legal pages — already wired

All legal copy lives in `src/components/legal/legal-page.tsx` (the `COMPANY`
object) and flows into every page. Legal name `TAXNOW (FZE)`, the SRTIP
address, `support@vibvid.ai`, and **Mamo as payment processor / TAXNOW as
seller of record** are already wired through Terms, Privacy, Refunds, Cookies,
Acceptable Use, and Contact. Just review them against your trade licence.

## 2. Point the site at your real domain

- `src/app/layout.tsx` `metadataBase` is `https://vibvid.ai`.
- The checkout return URLs are derived from the request origin, so they follow
  whatever domain the app is deployed on — no change needed once live.
- Make sure vibvid.ai is deployed and the footer legal links resolve publicly.

## 3. No products to create in Mamo

Unlike Paddle, there are **no per-item price ids**. `/api/checkout` creates a
hosted Mamo payment link on the fly, priced from `src/lib/billing.ts` (server
side, so the browser can't alter the amount). Subscriptions send a monthly
recurring config (`frequency: monthly`); top-ups are single-use. The webhook
re-checks the amount + currency before granting credits.

## 4. Environment variables (Vercel — Production + Preview)

```
MAMOPAY_ENV=sandbox          # switch to "production" when live
MAMOPAY_API_KEY=…            # Mamo dashboard → Developer → API keys (secret)
MAMOPAY_WEBHOOK_SECRET=…     # any strong random string you choose (see step 5)
```

Once `MAMOPAY_API_KEY` is set, `/api/checkout` starts real Mamo checkouts. With it
unset, the app falls back to demo credits (no charge).

Currency is **USD** (matches the billing catalog). Mamo supports USD; settlement
is handled by Mamo per your account terms.

## 5. Webhook

In the Mamo dashboard → **Developer → Webhooks**, add a webhook:

- URL: `https://vibvid.ai/api/mamo/webhook`
- Events: **`charge.succeeded`** and **`subscription.succeeded`**
  (add the `*.failed` events too if you want failure logging).
- **Auth header:** set it to exactly the same value as `MAMOPAY_WEBHOOK_SECRET`.
  Mamo echoes this in the `Authorization` header of every delivery, and
  `/api/mamo/webhook` verifies it in constant time.

The webhook matches the pending purchase we created (via `external_id` /
`custom_data.purchase_id`), checks amount + currency, and grants credits
idempotently on Mamo's charge id through the existing `settle_charge` RPC — so
replays and each monthly renewal credit exactly once.

## 6. Test in sandbox

With `MAMOPAY_ENV=sandbox` and a sandbox API key, run a checkout end-to-end using
Mamo's test card. Confirm: **click a plan → redirect to Mamo → pay → redirect
back to `/app?purchase=success` → webhook fires → credits land**. Test both a
one-time top-up and a subscription plan.

## 7. Flow summary

1. User picks a plan/pack → `POST /api/checkout` records a pending purchase and
   creates a Mamo payment link → returns `checkoutUrl`.
2. Browser redirects to Mamo's hosted checkout (we never touch card data).
3. On success Mamo redirects to `/app?purchase=success`; the app polls the
   webhook-granted credits in (guests get an account-confirmation email).
4. `charge.succeeded` / `subscription.succeeded` webhook → credits granted.
   Subscription renewals fire a fresh webhook each cycle → credits refill.

---

### Compliance surfaces (all on the site)

- ✅ Clear description of what you sell (landing page)
- ✅ Pricing with currency and renewal terms (pricing section + disclosure)
- ✅ Terms of Service — `/terms`
- ✅ Privacy Policy — `/privacy`
- ✅ Refund & Cancellation Policy — `/refunds`
- ✅ Cookie Policy — `/cookies`
- ✅ Acceptable Use Policy — `/acceptable-use`
- ✅ Contact page with a real support address and business identity — `/contact`
- ✅ Payment-processor + seller-of-record disclosure (footer + checkout + policies)
- ⚠️ Confirm UAE VAT/tax handling with your accountant (see tax note above)
