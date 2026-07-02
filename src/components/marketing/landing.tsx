import Link from "next/link";
import type { ReactNode } from "react";
import {
  Zap,
  Sparkles,
  FolderOpen,
  Film,
  ArrowRight,
  Check,
  Wand2,
  Layers,
  Clapperboard,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { HERO, HERO_CHIPS, SHOWCASE, type ShowcaseMedia } from "@/lib/showcase";

const APP = "/app";

/* ------------------------------ Primitives ------------------------------ */

function CTA({
  href,
  children,
  variant = "primary",
  size = "lg",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "outline" | "soft";
  size?: "md" | "lg";
  className?: string;
}) {
  const variants = {
    primary: "bg-accent text-white hover:bg-accent-2 shadow-[0_8px_24px_-8px_rgba(124,108,255,0.8)]",
    outline: "border border-line-2 text-fg hover:bg-surface-2 hover:border-faint",
    soft: "bg-surface-3 text-fg hover:bg-line-2",
  };
  const sizes = { md: "h-10 px-4 text-sm rounded-xl", lg: "h-12 px-6 text-[15px] rounded-xl" };
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-colors",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

function MediaTile({ m, className }: { m: ShowcaseMedia; className?: string }) {
  if (m.type === "video") {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={m.src}
        poster={m.poster}
        autoPlay
        muted
        loop
        playsInline
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={m.src} alt={m.label} className={cn("h-full w-full object-cover", className)} />;
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-teal shadow-[0_6px_18px_-6px_rgba(124,108,255,0.9)]">
        <Zap size={18} className="text-white" fill="white" />
      </span>
      <span className="text-[17px] font-bold tracking-tight">
        Mighty<span className="gradient-text">Studio</span>
      </span>
    </Link>
  );
}

/* -------------------------------- Sections ------------------------------ */

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          <a href="#features" className="transition-colors hover:text-fg">Features</a>
          <a href="#how" className="transition-colors hover:text-fg">How it works</a>
          <a href="#showcase" className="transition-colors hover:text-fg">Showcase</a>
          <a href="#pricing" className="transition-colors hover:text-fg">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <CTA href={APP} variant="soft" size="md" className="hidden sm:inline-flex">Sign in</CTA>
          <CTA href={APP} size="md">Start free</CTA>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* gradient backdrop */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 480px at 50% -10%, rgba(124,108,255,0.14), transparent 60%), radial-gradient(700px 400px at 85% 20%, rgba(13,148,136,0.10), transparent 55%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-24">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-medium text-muted">
          <Sparkles size={13} className="text-accent-2" /> Powered by ByteDance Seedance &amp; Seedream
        </div>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-[1.07] tracking-tight sm:text-6xl">
          Your entire production studio,
          <br className="hidden sm:block" /> <span className="gradient-text">one prompt away.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">
          Organize your brand&apos;s characters, wardrobe, scenes and audio — then generate on-brand
          video and images with best-in-class AI models. One simple studio, every output managed.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <CTA href={APP}>
            <Sparkles size={18} /> Start creating free
          </CTA>
          <CTA href="#how" variant="outline">
            See how it works <ArrowRight size={16} />
          </CTA>
        </div>
        <p className="mt-3 text-[13px] text-faint">No credit card needed · 1,200 free credits to start</p>

        {/* Hero visual */}
        <div className="relative mx-auto mt-12 max-w-4xl">
          <div className="overflow-hidden rounded-[20px] border border-line-2 bg-surface shadow-[0_30px_80px_-30px_rgba(16,18,27,0.45)]">
            <div className="aspect-video w-full bg-black">
              <MediaTile m={HERO} />
            </div>
          </div>
          {/* floating chips */}
          <div className="absolute -left-3 top-8 hidden rotate-[-6deg] sm:block">
            <FloatChip m={HERO_CHIPS[0]} />
          </div>
          <div className="absolute -right-4 top-24 hidden rotate-[5deg] sm:block">
            <FloatChip m={HERO_CHIPS[1]} />
          </div>
          <div className="absolute -bottom-5 left-1/3 hidden rotate-[3deg] md:block">
            <FloatChip m={HERO_CHIPS[2]} />
          </div>
        </div>
      </div>
    </section>
  );
}

function FloatChip({ m }: { m: ShowcaseMedia }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-line-2 bg-surface/90 p-1.5 pr-3 shadow-[0_12px_30px_-12px_rgba(16,18,27,0.4)] backdrop-blur">
      <span className="h-10 w-10 overflow-hidden rounded-xl">
        <MediaTile m={m} />
      </span>
      <span className="text-left">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-accent-2">{m.tag}</span>
        <span className="block text-[13px] font-semibold text-fg">{m.label}</span>
      </span>
    </div>
  );
}

function ModelBand() {
  const items = ["Seedance 2.0 Pro", "Seedance 2.0 Lite", "Seedream 3.0", "SeedEdit 3.0", "+ more models soon"];
  return (
    <section className="border-y border-line bg-surface-2/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-5">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-faint">Plug-and-play models</span>
        {items.map((i) => (
          <span key={i} className="text-sm font-medium text-muted">{i}</span>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: FolderOpen,
    title: "Your brand, organized",
    body: "Upload characters, wardrobe, scenes, dances and audio into one library. Bundle a face, a reference clip and a voice into a single reusable identity.",
  },
  {
    icon: Sparkles,
    title: "Make in one click",
    body: "Describe a shot or assemble it from your assets, pick a model, and generate. Video or image — the controls adapt to whatever model you choose.",
  },
  {
    icon: Film,
    title: "Manage everything",
    body: "Every output lands in your Library with the prompt, model and source assets attached. Re-roll, make variations, or promote a keeper back into your assets.",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">One studio, the whole pipeline</h2>
        <p className="mt-3 text-[17px] text-muted">From raw brand assets to finished, managed content — without juggling five different tools.</p>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-[var(--radius-xl2)] border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(16,18,27,0.04),0_10px_26px_-18px_rgba(16,18,27,0.14)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-2">
              <f.icon size={20} />
            </span>
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { n: "1", icon: Layers, title: "Build your library", body: "Organize your assets into five classes — Characters, Dresses, Scenes, Dances and Audio. My library and Business library, side by side." },
  { n: "2", icon: Wand2, title: "Make your shot", body: "Type a prompt, or pull assets into the slots to compose one. Choose a video or image model and hit generate." },
  { n: "3", icon: Clapperboard, title: "Manage & reuse", body: "Find every clip and image in your Library, see exactly what made it, and remix or promote it into a new asset." },
];

function Steps() {
  return (
    <section id="how" className="border-y border-line bg-surface-2/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">From idea to output in three steps</h2>
          <p className="mt-3 text-[17px] text-muted">Simple enough for a first-timer, deep enough for a real production.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-[var(--radius-xl2)] border border-line bg-surface p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">{s.n}</span>
                <s.icon size={20} className="text-accent-2" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section id="showcase" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <Badge tone="accent" className="mb-3">Made with Mighty Studio</Badge>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Output that looks the part</h2>
        <p className="mt-3 text-[17px] text-muted">Video and images generated in seconds — every one ready to drop into your campaign.</p>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {SHOWCASE.map((m, i) => (
          <div
            key={m.id}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-line bg-surface-2",
              i % 5 === 0 ? "col-span-2 aspect-video" : "aspect-square",
            )}
          >
            <MediaTile m={m} className="transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute bottom-2.5 left-3 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="block text-[11px] font-medium text-white/70">{m.tag}</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-white">
                {m.type === "video" && <Play size={12} fill="white" />} {m.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const PLANS = [
  { name: "Starter", price: "$7", credits: "500", blurb: "For trying things out.", popular: false,
    perks: ["500 credits", "All ByteDance models", "Video + image", "Personal asset library"] },
  { name: "Plus", price: "$20", credits: "1,600", blurb: "For regular creators.", popular: true,
    perks: ["1,600 credits", "Everything in Starter", "Business asset library", "Composite assets", "Priority rendering"] },
  { name: "Studio", price: "$60", credits: "5,500", blurb: "For teams in production.", popular: false,
    perks: ["5,500 credits", "Everything in Plus", "Highest quality (2K)", "Bulk generation", "Early access to new models"] },
];

function Pricing() {
  return (
    <section id="pricing" className="border-t border-line bg-surface-2/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, credit-based pricing</h2>
          <p className="mt-3 text-[17px] text-muted">Credits work across every model. Top up any time, or subscribe to refill monthly.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={cn(
                "relative flex flex-col rounded-[var(--radius-xl2)] border bg-surface p-6",
                p.popular ? "border-accent/50 shadow-[0_20px_50px_-24px_rgba(124,108,255,0.6)]" : "border-line",
              )}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge tone="accent">Most popular</Badge>
                </span>
              )}
              <div className="text-sm font-semibold text-muted">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-4xl font-bold tracking-tight">{p.price}</span>
                <span className="text-sm text-faint">/ {p.credits} credits</span>
              </div>
              <p className="mt-1 text-[13px] text-faint">{p.blurb}</p>
              <ul className="mt-5 space-y-2.5">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-[14px] text-fg">
                    <Check size={16} className="mt-0.5 shrink-0 text-teal" /> {perk}
                  </li>
                ))}
              </ul>
              <CTA href={APP} variant={p.popular ? "primary" : "outline"} className="mt-6 w-full">
                Get started
              </CTA>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="relative overflow-hidden rounded-[24px] border border-accent/30 bg-gradient-to-br from-accent to-teal px-6 py-14 text-center text-white shadow-[0_30px_80px_-30px_rgba(124,108,255,0.7)]">
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Start producing today
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[16px] text-white/85">
          Spin up your studio in seconds. Your first 1,200 credits are on us.
        </p>
        <div className="mt-7 flex justify-center">
          <Link
            href={APP}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-7 text-[15px] font-semibold text-accent-2 transition-transform hover:scale-[1.02]"
          >
            <Sparkles size={18} /> Create your first video
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
        <Brand />
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
          <a href="#features" className="hover:text-fg">Features</a>
          <a href="#how" className="hover:text-fg">How it works</a>
          <a href="#pricing" className="hover:text-fg">Pricing</a>
          <Link href={APP} className="hover:text-fg">Launch studio</Link>
        </nav>
        <p className="text-[13px] text-faint">© 2026 Mighty Studio</p>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <ModelBand />
        <Features />
        <Steps />
        <Showcase />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
