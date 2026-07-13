import type { Metadata } from "next";
import { Header, Pricing, FAQ, Footer } from "@/components/marketing/landing";

export const metadata: Metadata = {
  title: "Pricing — VIBVID.AI",
  description:
    "Simple monthly plans for VIBVID.AI. Start free, then scale on credits — Creator, Pro and Agency. Cancel anytime.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
