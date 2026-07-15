import type { Metadata } from "next";
import { Header, Pricing, FAQ, Footer } from "@/components/marketing/landing";

export const metadata: Metadata = {
  title: "Pricing — VIBVID.AI",
  description:
    "Simple plans for VIBVID.AI — Creator, Pro and Agency, from $19/month. Pay yearly and get 4 months on us. Cancel anytime.",
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
