"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, FolderOpen, Plus, Coins, Zap, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button, Modal, Badge } from "@/components/ui";

const NAV = [
  { href: "/app", label: "Make", icon: Sparkles },
  { href: "/app/assets", label: "Assets", icon: FolderOpen },
  { href: "/app/library", label: "Library", icon: Film },
];

const CREDIT_PACKS = [
  { credits: 500, price: "$7", label: "Mini" },
  { credits: 1600, price: "$20", label: "Plus", popular: true },
  { credits: 5500, price: "$60", label: "Mega" },
];

function Brand() {
  return (
    <Link href="/app" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-teal shadow-[0_6px_18px_-6px_rgba(124,108,255,0.9)]">
        <Zap size={18} className="text-white" fill="white" />
      </span>
      <span className="text-[17px] font-bold tracking-tight">
        Mighty<span className="gradient-text">MAK</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent-soft text-fg"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon size={18} className={active ? "text-accent-2" : ""} />
            {label}
          </Link>
        );
      })}
    </>
  );
}

function CreditWidget({ onBuy }: { onBuy: () => void }) {
  const credits = useStore((s) => s.credits);
  const hydrated = useStore((s) => s.hasHydrated);
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5">
        <Coins size={15} className="text-warn" />
        <span className="text-sm font-semibold tabular-nums">
          {hydrated ? credits.toLocaleString() : "—"}
        </span>
        <span className="text-xs text-faint">credits</span>
      </div>
      <Button size="sm" variant="soft" onClick={onBuy} className="gap-1.5">
        <Plus size={15} /> Buy
      </Button>
    </div>
  );
}

function BuyCreditsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addCredits = useStore((s) => s.addCredits);
  return (
    <Modal open={open} onClose={onClose} title="Buy credits" size="md">
      <p className="mb-4 text-sm text-muted">
        Demo mode — purchases instantly add credits, no payment required. Real Stripe
        checkout plugs in here later.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CREDIT_PACKS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              addCredits(p.credits);
              onClose();
            }}
            className={cn(
              "relative rounded-2xl border bg-surface-2 p-4 text-left transition-colors hover:border-accent/50",
              p.popular ? "border-accent/40" : "border-line",
            )}
          >
            {p.popular && (
              <span className="absolute right-3 top-3">
                <Badge tone="accent">Popular</Badge>
              </span>
            )}
            <div className="text-sm font-medium text-muted">{p.label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {p.credits.toLocaleString()}
            </div>
            <div className="text-xs text-faint">credits</div>
            <div className="mt-3 text-lg font-semibold text-accent-2">{p.price}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [buyOpen, setBuyOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/60 px-4 py-5 backdrop-blur-md md:flex">
        <div className="px-1">
          <Brand />
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          <NavLinks />
        </nav>
        <div className="mt-auto">
          <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs text-muted">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-fg">
              <Sparkles size={13} className="text-teal" /> Front-end demo
            </div>
            Powered by ByteDance models (simulated). Data is saved in your browser.
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="md:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="md:hidden">
              <Brand />
            </div>
            <div className="hidden text-sm text-faint md:block" />
            <CreditWidget onBuy={() => setBuyOpen(true)} />
          </div>
        </header>

        <main className="px-4 pb-24 pt-6 sm:px-6 md:pb-10">{children}</main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur-md md:hidden">
        <MobileNav />
      </nav>

      <BuyCreditsModal open={buyOpen} onClose={() => setBuyOpen(false)} />
    </div>
  );
}

function MobileNav() {
  const pathname = usePathname();
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              active ? "text-accent-2" : "text-faint",
            )}
          >
            <Icon size={20} />
            {label}
          </Link>
        );
      })}
    </>
  );
}
