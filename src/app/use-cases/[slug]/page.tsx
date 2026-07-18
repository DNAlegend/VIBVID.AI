// One SEO page per commercial use case: buyer pain → how VIBVID does it →
// example prompts that deep-link into the studio → pricing CTA → FAQ.
// Content lives in src/lib/use-cases.ts; media resolves through the demo
// catalog (real clips when generated, styled placeholders otherwise).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Wand2 } from "lucide-react";
import { Header, Footer, CTA, FAQ, DemoMedia, DemoCard } from "@/components/marketing/landing";
import { Badge } from "@/components/ui";
import { USE_CASES, USE_CASE_BY_SLUG, demosFor, heroDemo } from "@/lib/use-cases";

export function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const u = USE_CASE_BY_SLUG[(await params).slug];
  return u ? { title: u.metaTitle, description: u.metaDescription } : {};
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const u = USE_CASE_BY_SLUG[(await params).slug];
  if (!u) notFound();

  const demo = heroDemo(u);
  const demos = demosFor(u);
  const others = USE_CASES.filter((x) => x.slug !== u.slug);
  const tryHref = (prompt: string) =>
    `/app/make?purpose=${u.purposeId}&prompt=${encodeURIComponent(prompt)}`;

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        {/* Hero */}
        <section className="border-b border-line">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2">
            <div>
              <Badge tone="accent">{u.buyer}</Badge>
              <h1 className="font-display mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-[44px]">
                {u.title}
              </h1>
              <p className="mt-4 text-[16.5px] leading-relaxed text-muted">{u.intro}</p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <CTA href="/subscribe">
                  <Wand2 size={17} /> Start creating
                </CTA>
                <CTA href="/pricing" variant="outline">
                  See pricing <ArrowRight size={15} />
                </CTA>
              </div>
              <p className="mt-3 text-[13px] text-faint">
                Plans from $19/month · 4 months on us when billed yearly · cancel anytime
              </p>
            </div>
            <div className="overflow-hidden rounded-[var(--radius-xl2)] border border-line bg-surface shadow-[0_30px_70px_-30px_rgba(16,18,27,0.4)]">
              <DemoMedia d={demo} />
            </div>
          </div>
        </section>

        {/* Pain → solution */}
        <section className="border-b border-line bg-surface-2/40">
          <div className="mx-auto grid max-w-6xl gap-5 px-4 py-14 sm:px-6 md:grid-cols-2">
            <div className="rounded-[var(--radius-xl2)] border border-line bg-surface p-6">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">The old way</div>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{u.pain}</p>
            </div>
            <div className="rounded-[var(--radius-xl2)] border border-accent/30 bg-accent-soft/40 p-6">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-accent-2">With VIBVID</div>
              <p className="mt-2 text-[15px] leading-relaxed text-fg">{u.intro}</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {u.steps.map((s, i) => (
              <div key={s.title} className="rounded-[var(--radius-xl2)] border border-line bg-surface p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-[14px] font-bold text-accent-2">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-[15px] font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Example prompts */}
        <section className="border-y border-line bg-surface-2/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Real prompts to start from
              </h2>
              <p className="mt-3 text-[15.5px] text-muted">
                Tap any prompt to open it in the studio and make it yours.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {demos.map((d) => (
                <DemoCard key={d.id} d={d} />
              ))}
              {u.extraPrompts.map((p) => (
                <div
                  key={p.title}
                  className="flex flex-col overflow-hidden rounded-[var(--radius-xl2)] border border-line bg-surface p-4"
                >
                  <h3 className="text-[15px] font-semibold">{p.title}</h3>
                  <p className="mt-2 flex-1 rounded-xl border border-line bg-surface-2 p-2.5 text-[12.5px] leading-relaxed text-muted">
                    “{p.prompt}”
                  </p>
                  <Link
                    href={tryHref(p.prompt)}
                    className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-2 transition-colors hover:text-accent"
                  >
                    <Wand2 size={14} /> Try this prompt <ArrowRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing strip */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 rounded-[var(--radius-xl2)] border border-line bg-surface px-6 py-6 sm:flex-row">
            <div>
              <div className="text-[15px] font-semibold">Simple plans, from $19/month</div>
              <p className="mt-1 text-[13px] text-muted">
                Creator, Pro and Agency — every plan is a monthly credit budget. Pay yearly and
                get 4 months on us. Cancel anytime.
              </p>
            </div>
            <CTA href="/pricing" size="md" className="shrink-0">
              See pricing <ArrowRight size={15} />
            </CTA>
          </div>
        </section>

        {/* Use-case FAQ */}
        {u.faqs.length > 0 && <FAQ items={u.faqs} />}

        {/* More use cases */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-xl font-bold tracking-tight">More use cases</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((x) => (
              <Link
                key={x.slug}
                href={`/use-cases/${x.slug}`}
                className="group rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-fg">{x.label}</span>
                  <ArrowRight size={14} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{x.pain}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
