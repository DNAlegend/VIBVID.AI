"use client";

// The mobile navigation menu for the marketing header. Kept as its own client
// component so the landing page itself can stay a server component. Opens a
// full-width sheet under the header, closes on link tap, backdrop tap, Escape,
// or a resize up to desktop — and locks body scroll while open.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";

const NAV_LINKS = [
  { href: "/#styles", label: "Styles" },
  { href: "/#how", label: "How it works" },
  { href: "/#compare", label: "Compare" },
  { href: "/pricing", label: "Pricing" },
];

export function MobileNav({ appHref }: { appHref: string }) {
  const [open, setOpen] = useState(false);

  // Close on Escape, and lock body scroll while the sheet is open. Also close
  // when the viewport widens past the desktop breakpoint — the CSS hides the
  // sheet there, and without this the invisible menu kept the page
  // scroll-locked.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Matches the header's lg breakpoint — the sheet dies when the full nav returns.
    const mq = window.matchMedia("(min-width: 1024px)");
    const onWiden = (e: MediaQueryListEvent) => e.matches && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWiden);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWiden);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-line-2 bg-surface/60 text-fg transition-colors hover:bg-surface-2"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <>
          {/* backdrop — starts below the floating header so its toggle stays tappable */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 top-16 z-40 h-[calc(100dvh-4rem)] bg-black/30 backdrop-blur-sm"
          />
          {/* sheet — a floating glass card, matching the pill header above it */}
          <nav className="glass-strong animate-rise fixed inset-x-2 top-[4.5rem] z-50 rounded-[28px] p-3">
            <div className="flex flex-col gap-0.5">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-2xl px-3.5 py-3.5 text-[16px] font-medium text-fg transition-colors hover:bg-surface-2 active:bg-surface-2"
                >
                  {l.label}
                  <ArrowRight size={16} className="text-faint" />
                </Link>
              ))}
            </div>
            <div className="mt-3 px-1 pb-1">
              <Link
                href={appHref}
                onClick={() => setOpen(false)}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(236,19,32,0.7)] transition-colors hover:bg-accent-2"
              >
                Make your first ad <ArrowRight size={16} />
              </Link>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
