// The VIBVID mark: a bold "V" drawn in one gradient stroke on a dark tile,
// with a play triangle nested inside it — the video studio cue.
// One shape, one gradient: reads crisply from favicon size up.

import { cn } from "@/lib/utils";

export function LogoMark({
  size = 36,
  animated = true,
  className,
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="vv-g" x1="6" y1="8" x2="34" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c6cff" />
          <stop offset="0.52" stopColor="#a55dff" />
          <stop offset="1" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>

      {/* tile */}
      <rect width="40" height="40" rx="10" fill="#0d0d15" />
      <rect x="0.5" y="0.5" width="39" height="39" rx="9.5" fill="none" stroke="rgba(255,255,255,0.12)" />

      {/* the V — one continuous stroke */}
      <path
        d="M10 10.5 L20 29.5 L30 10.5"
        fill="none"
        stroke="url(#vv-g)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* play cue nested in the V */}
      <path d="M16.7 14.5 L23.3 17.9 L16.7 21.3 Z" fill="#2dd4bf">
        {animated && (
          <animate attributeName="opacity" values="1;0.55;1" dur="3.2s" repeatCount="indefinite" />
        )}
      </path>
    </svg>
  );
}

/**
 * The logo is letters only: VIBVID.AI.
 * "VIB" in ink, "VID" in the brand gradient, and the period drawn as a
 * tiny gradient pixel — the one graphic gesture left from the mark.
 */
export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display inline-flex items-baseline text-[19px] font-bold tracking-[-0.02em] text-fg",
        className,
      )}
    >
      VIB
      <span
        className="bg-clip-text text-transparent"
        style={{ backgroundImage: "linear-gradient(94deg, #6d5ef8, #a95dff)" }}
      >
        VID
      </span>
      <span
        aria-hidden
        className="mx-[0.12em] inline-block h-[0.17em] w-[0.17em] rounded-[0.05em]"
        style={{ background: "linear-gradient(135deg, #0d9488, #2dd4bf)" }}
      />
      <span className="font-semibold text-muted">AI</span>
    </span>
  );
}
