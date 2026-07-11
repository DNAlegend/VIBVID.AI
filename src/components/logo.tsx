// The MightyMak mark: a bold geometric "M" drawn in one gradient stroke on a
// dark tile, with a play triangle nested in its valley — the video studio cue.
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
        <linearGradient id="mm-g" x1="6" y1="34" x2="34" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c6cff" />
          <stop offset="0.52" stopColor="#a55dff" />
          <stop offset="1" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>

      {/* tile */}
      <rect width="40" height="40" rx="10" fill="#0d0d15" />
      <rect x="0.5" y="0.5" width="39" height="39" rx="9.5" fill="none" stroke="rgba(255,255,255,0.12)" />

      {/* the M — one continuous stroke */}
      <path
        d="M9.5 30.5 V11 L20 21 L30.5 11 V30.5"
        fill="none"
        stroke="url(#mm-g)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* play cue in the M's valley */}
      <path d="M17.8 24.6 L24.2 27.7 L17.8 30.8 Z" fill="#2dd4bf">
        {animated && (
          <animate attributeName="opacity" values="1;0.55;1" dur="3.2s" repeatCount="indefinite" />
        )}
      </path>
    </svg>
  );
}

/** The logo is letters only: MightyMak.ai — two-tone with a quiet suffix. */
export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-[19px] font-bold tracking-tight text-fg", className)}>
      Mighty<span className="gradient-text">Mak</span>
      <span className="font-semibold text-faint">.ai</span>
    </span>
  );
}
