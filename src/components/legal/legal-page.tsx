// Shared chrome for the legal / policy pages (Terms, Privacy, Refunds,
// Acceptable Use, Contact). These pages exist for two audiences: real
// customers, and payment-provider compliance reviewers — who check that a
// storefront has clear terms, a privacy policy, a refund policy, and a way to
// reach a real, named business. Keep them linked from every footer.

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { LogoWordmark } from "@/components/logo";

/** The business behind VIBVID: the brand is VIBVID.AI, the company is TAXNOW FZE. */
export const COMPANY = {
  brand: "VIBVID.AI",
  /** The legal entity named across all legal copy. */
  legalName: "TAXNOW FZE",
  /** Governing-law wording for the Terms — tied to the entity, no country named. */
  jurisdiction: "the jurisdiction in which TAXNOW FZE is registered",
  supportEmail: "support@vibvid.ai",
  /** One real inbox — sales/business inquiries also route to support. */
  salesEmail: "support@vibvid.ai",
  /**
   * Stripe is our payment processor: it securely handles card payments and
   * subscriptions. VIBVID.AI™ is the seller for all transactions.
   */
  paymentProcessor: "Stripe",
  paymentProcessorSite: "https://stripe.com",
} as const;

/** Footer/nav links to every legal page — reused across the marketing site. */
export const LEGAL_LINKS: { href: string; label: string }[] = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/refunds", label: "Refund & Cancellation" },
  { href: "/acceptable-use", label: "Acceptable Use" },
  { href: "/contact", label: "Contact" },
];

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-2 z-30 px-2 sm:top-3 sm:px-4">
        <div className="glass mx-auto flex h-14 max-w-3xl items-center justify-between rounded-full pl-4 pr-2 sm:pl-5 sm:pr-3">
          <Link href="/" className="flex items-center">
            <LogoWordmark />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2/80 hover:text-fg"
          >
            <ArrowLeft size={15} /> Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-[13px] text-faint">Last updated: {updated}</p>
        {intro && <div className="mt-6 text-[15px] leading-relaxed text-muted">{intro}</div>}
        <div className="legal-body mt-8 space-y-6 text-[15px] leading-relaxed text-fg">
          {children}
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-fg">
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="mt-6 text-[13px] text-faint">
            Card payments and subscriptions are processed securely by our payment processor,{" "}
            {COMPANY.paymentProcessor}.
          </p>
          <p className="mt-2 text-[13px] text-faint">© 2026 {COMPANY.legalName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

/** A titled section within a legal page. */
export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold tracking-tight text-fg">{heading}</h2>
      <div className="space-y-3 text-muted">{children}</div>
    </section>
  );
}
