// Billing catalog — the single source of truth for what can be purchased.
// The client renders these; the server (/api/checkout) looks the amount and
// credits up here by id, so the price a user pays is never client-controlled.

export interface BillingItem {
  id: string;
  label: string;
  kind: "topup" | "subscription";
  /** Credits granted per successful charge (per month, for subscriptions). */
  credits: number;
  /** Price in major units of `currency` (e.g. 12 = $12.00). */
  amount: number;
  /** All charges are in US dollars only. */
  currency: "USD";
  priceLabel: string;
  sublabel: string;
  popular?: boolean;
}

/** One-off credit packs — "buy more as you need". */
export const TOPUPS: BillingItem[] = [
  { id: "topup-300", label: "Small", kind: "topup", credits: 300, amount: 6, currency: "USD", priceLabel: "$6", sublabel: "≈ 5 videos" },
  { id: "topup-1200", label: "Popular", kind: "topup", credits: 1200, amount: 20, currency: "USD", priceLabel: "$20", sublabel: "≈ 20 videos", popular: true },
  { id: "topup-3000", label: "Big", kind: "topup", credits: 3000, amount: 45, currency: "USD", priceLabel: "$45", sublabel: "≈ 50 videos" },
];

/**
 * Monthly subscription plans — paid only, no free tier. Sublabels are honest
 * against the quality-priced credit rates: a 5s Production 1080p render is
 * 120 credits, a 5s Draft 480p take is 15.
 */
export const PLAN_ITEMS: BillingItem[] = [
  { id: "plan-basic", label: "Basic", kind: "subscription", credits: 700, amount: 15, currency: "USD", priceLabel: "$15", sublabel: "≈ 5 pro videos or 45 drafts / mo" },
  { id: "plan-creator", label: "Creator", kind: "subscription", credits: 1500, amount: 29, currency: "USD", priceLabel: "$29", sublabel: "≈ 12 pro videos or 100 drafts / mo", popular: true },
  { id: "plan-max", label: "Max", kind: "subscription", credits: 3200, amount: 59, currency: "USD", priceLabel: "$59", sublabel: "≈ 26 pro videos / mo — best value" },
];

export const BILLING_ITEMS: BillingItem[] = [...TOPUPS, ...PLAN_ITEMS];

export function billingItem(id: string): BillingItem | null {
  return BILLING_ITEMS.find((i) => i.id === id) ?? null;
}
