# Paddle approval & go-live checklist

This repo is now set up for Paddle (merchant of record). Below is everything you
still need to do outside the code before Paddle will approve you and before real
charges work.

## 1. Fill in the placeholders in the legal pages

All legal copy lives in `src/components/legal/legal-page.tsx` (the `COMPANY`
object) and flows into every page. Replace these placeholders with your real
trade-licence details:

- `address` — currently `[REGISTERED ADDRESS — from trade licence]`. Put the
  registered address from the taxnow FZE licence.
- `jurisdiction` — currently `the United Arab Emirates`. If Paddle wants the
  specific free zone/emirate (e.g. "Dubai, UAE" / "Sharjah Media City, UAE"),
  set it here.

Everything else (legal name `taxnow FZE`, `support@vibvid.ai`, Paddle as MoR)
is already wired through Terms, Privacy, Refunds, Acceptable Use, and Contact.

## 2. Point the site at your real domain

- `src/app/layout.tsx` `metadataBase` is set to `https://vibvid.ai`. The
  checkout return-URL fallback (`src/app/api/checkout/route.ts`) and the
  MamoPay setup script also point at `https://vibvid.ai`.
- Paddle reviews a **live** site at the domain on your account. Make sure
  vibvid.ai is deployed and the footer legal links resolve publicly.
- In the Paddle dashboard, add vibvid.ai as an **approved domain** (Checkout →
  Website approval / Domains) so Paddle.js can open on your site.

## 3. Create products & prices in Paddle

For each billing item in `src/lib/billing.ts`, create a Paddle **Price** (a
recurring price for plans, a one-time price for top-ups) and copy its `pri_…` id
into an env var named `PADDLE_PRICE_<ITEM_ID>` (item id upper-cased, `-` → `_`):

| Billing item id | Env var                    |
| --------------- | -------------------------- |
| `plan-creator`  | `PADDLE_PRICE_PLAN_CREATOR`|
| `plan-pro`      | `PADDLE_PRICE_PLAN_PRO`    |
| `plan-agency`   | `PADDLE_PRICE_PLAN_AGENCY` |
| `topup-200`     | `PADDLE_PRICE_TOPUP_200`   |
| `topup-600`     | `PADDLE_PRICE_TOPUP_600`   |
| `topup-1500`    | `PADDLE_PRICE_TOPUP_1500`  |
| `topup-5000`    | `PADDLE_PRICE_TOPUP_5000`  |

Set each Paddle price to the same amount as `billing.ts` (USD). The webhook
re-checks the amount before granting credits, so they must match.

## 4. Environment variables (Vercel)

```
PADDLE_ENV=sandbox                     # switch to "production" when live
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=live_… # Paddle → Developer tools → Authentication
PADDLE_API_KEY=…                       # (reserved for future server calls)
PADDLE_WEBHOOK_SECRET=whsec_…          # from the notification destination below
PADDLE_PRICE_PLAN_PRO=pri_…            # …and the rest from the table above
```

Once `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` **and** at least one `PADDLE_PRICE_*` are
set, `/api/checkout` automatically uses Paddle instead of MamoPay. With neither
provider configured, the app falls back to demo credits (no charge).

## 5. Webhook (notification destination)

In Paddle → Developer tools → Notifications, add a destination:

- URL: `https://vibvid.ai/api/paddle/webhook`
- Events: **`transaction.completed`** (add `transaction.paid` if you want).
- Copy the signing secret into `PADDLE_WEBHOOK_SECRET`.

The webhook verifies Paddle's signature over the raw body, matches the pending
purchase we created, checks the amount/currency, and grants credits idempotently
via the existing `settle_charge` RPC — so replays and monthly renewals each
credit exactly once.

## 6. Test in sandbox

With `PADDLE_ENV=sandbox`, run a checkout end-to-end using Paddle's
[test card](https://developer.paddle.com/concepts/payment-methods/credit-debit-card).
Confirm: overlay opens → payment completes → webhook fires → credits land.

## 7. Retiring MamoPay (optional, after Paddle is live)

The MamoPay code paths still exist as a fallback (`src/lib/mamopay.ts`,
`src/app/api/mamopay/webhook/route.ts`, and the `MamoInlineCheckout` component
in `app-shell.tsx`). Once Paddle is confirmed working in production, you can
remove them and the MamoPay env vars.

---

### What Paddle's reviewers check (all now on the site)

- ✅ Clear description of what you sell (landing page)
- ✅ Pricing with currency and renewal terms (pricing section + disclosure)
- ✅ Terms of Service — `/terms`
- ✅ Privacy Policy — `/privacy`
- ✅ Refund & Cancellation Policy — `/refunds`
- ✅ Acceptable Use Policy — `/acceptable-use` (deepfake/likeness rules)
- ✅ Contact page with a real support address and business identity — `/contact`
- ✅ Merchant-of-record disclosure naming Paddle (footer + checkout + policies)
- ⚠️ Live site at your real domain with the address filled in (steps 1–2)
