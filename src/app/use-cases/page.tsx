import type { Metadata } from "next";
import { Header, Footer, UseCaseCard } from "@/components/marketing/landing";
import { USE_CASES } from "@/lib/use-cases";

export const metadata: Metadata = {
  title: "AI Video Use Cases — VIBVID.AI",
  description:
    "What teams make with VIBVID: AI UGC ads, product explainers, training videos, course visuals, internal comms and onboarding content. From $19/month.",
};

export default function UseCasesPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
              What teams ship with VIBVID
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              One studio, six jobs. Original scenes with consistent characters and your real
              products — planned by the Strategist, produced in 1080p, cut in Post. Pick your
              use case and see the exact workflow.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((u) => (
              <UseCaseCard key={u.slug} u={u} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
