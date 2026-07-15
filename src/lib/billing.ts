// Billing catalog — the single source of truth for what can be purchased.
// The client renders these; the server (/api/checkout) looks the amount and
// credits up here by id, so the price a user pays is never client-controlled.
//
// Pricing is credit-based and internal on purpose: customers spend VIBVID
// credits, never a raw provider cost, so our margin and model mix stay ours.
// See docs at the bottom for the credit economics.

export interface BillingItem {
  id: string;
  label: string;
  kind: "topup" | "subscription";
  /** Subscription billing interval. Monthly plans refill monthly; annual plans deposit a full year of credits on each yearly charge. */
  interval?: "month" | "year";
  /** Credits granted per successful charge (per billing cycle, for subscriptions). */
  credits: number;
  /** Price in major units of `currency` (e.g. 19 = $19.00). */
  amount: number;
  /** Charge currency. USD today; AED shown alongside for the UAE market. */
  currency: "USD";
  priceLabel: string;
  /** Secondary price shown for the local market (display only). */
  aedLabel?: string;
  sublabel: string;
  popular?: boolean;
  /** Top-up credits expire this many months after purchase (subscription credits reset each cycle). */
  expiresMonths?: number;
}

/**
 * One-off credit packs — "buy more as you need". Priced a touch above the
 * subscription rate ($0.05–0.075 / credit) so upgrading always looks better.
 * Packs expire after 12 months.
 */
export const TOPUPS: BillingItem[] = [
  { id: "topup-200", label: "Starter", kind: "topup", credits: 200, amount: 15, currency: "USD", priceLabel: "$15", aedLabel: "AED 55", sublabel: "≈ 2 Full-HD clips (5s each)", expiresMonths: 12 },
  { id: "topup-600", label: "Popular", kind: "topup", credits: 600, amount: 39, currency: "USD", priceLabel: "$39", aedLabel: "AED 143", sublabel: "≈ 6 Full-HD clips (5s each)", popular: true, expiresMonths: 12 },
  { id: "topup-1500", label: "Value", kind: "topup", credits: 1500, amount: 89, currency: "USD", priceLabel: "$89", aedLabel: "AED 327", sublabel: "≈ 16 Full-HD clips (5s each)", expiresMonths: 12 },
  { id: "topup-5000", label: "Bulk", kind: "topup", credits: 5000, amount: 249, currency: "USD", priceLabel: "$249", aedLabel: "AED 914", sublabel: "≈ 55 Full-HD clips (5s each)", expiresMonths: 12 },
];

/**
 * Subscription plans — three tiers, no free tier, no trial. Credits refill
 * each billing cycle. Sublabels are honest against the credit rates in
 * models.ts — a 5s 1080p (Full HD, native audio) Production render is ~90
 * credits, a 5s 720p HD render ~45, a standard image ~3. No unlimited tier:
 * generation cost is variable, so every plan is a fixed credit budget.
 *
 * Annual = pay for 8 months, get 12 ("4 months on us"). A yearly charge
 * deposits the full year of credits (12× monthly) up front.
 */
export const PLAN_ITEMS: BillingItem[] = [
  { id: "plan-creator", label: "Creator", kind: "subscription", interval: "month", credits: 300, amount: 19, currency: "USD", priceLabel: "$19", aedLabel: "AED 70", sublabel: "≈ 3 Full-HD clips (5s each) or 6 in HD / mo" },
  { id: "plan-pro", label: "Pro", kind: "subscription", interval: "month", credits: 800, amount: 39, currency: "USD", priceLabel: "$39", aedLabel: "AED 143", sublabel: "≈ 8 Full-HD clips (5s each) or 17 in HD / mo", popular: true },
  { id: "plan-agency", label: "Agency", kind: "subscription", interval: "month", credits: 1500, amount: 69, currency: "USD", priceLabel: "$69", aedLabel: "AED 253", sublabel: "≈ 16 Full-HD clips (5s each) or 33 in HD / mo" },
];

/** Annual twins of PLAN_ITEMS: 8× the monthly price, 12× the monthly credits. */
export const PLAN_ITEMS_YEARLY: BillingItem[] = [
  { id: "plan-creator-year", label: "Creator", kind: "subscription", interval: "year", credits: 3600, amount: 152, currency: "USD", priceLabel: "$152", aedLabel: "AED 558", sublabel: "3,600 credits up front — 4 months on us" },
  { id: "plan-pro-year", label: "Pro", kind: "subscription", interval: "year", credits: 9600, amount: 312, currency: "USD", priceLabel: "$312", aedLabel: "AED 1,146", sublabel: "9,600 credits up front — 4 months on us", popular: true },
  { id: "plan-agency-year", label: "Agency", kind: "subscription", interval: "year", credits: 18000, amount: 552, currency: "USD", priceLabel: "$552", aedLabel: "AED 2,027", sublabel: "18,000 credits up front — 4 months on us" },
];

export const BILLING_ITEMS: BillingItem[] = [...TOPUPS, ...PLAN_ITEMS, ...PLAN_ITEMS_YEARLY];

export function billingItem(id: string): BillingItem | null {
  return BILLING_ITEMS.find((i) => i.id === id) ?? null;
}

/** The yearly twin of a monthly plan (or the monthly twin of a yearly id). */
export function planVariant(id: string, interval: "month" | "year"): BillingItem | null {
  const base = id.replace(/-year$/, "");
  return billingItem(interval === "year" ? `${base}-year` : base);
}
