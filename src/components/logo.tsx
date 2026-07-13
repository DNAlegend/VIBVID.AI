// The VIBVID mark: the logo's red "VID" pill distilled to a square —
// a rounded red tile with a white play triangle. Reads at favicon size up.

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
      {/* the red pill, squared for the app icon */}
      <rect width="40" height="40" rx="11" fill="#ec1320" />
      {/* play cue — the video studio gesture */}
      <path d="M16 13 L28 20 L16 27 Z" fill="#ffffff">
        {animated && (
          <animate attributeName="opacity" values="1;0.6;1" dur="3.2s" repeatCount="indefinite" />
        )}
      </path>
    </svg>
  );
}

/**
 * The wordmark, exactly as the logo draws it: "VIB" in ink, then "VID" in white
 * on a red pill with a play triangle, then a muted ".AI".
 */
export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display inline-flex items-center text-[19px] font-extrabold leading-none tracking-[-0.03em] text-fg",
        className,
      )}
    >
      <span>VIB</span>
      <span className="ml-[0.12em] inline-flex items-center gap-[0.14em] rounded-[0.4em] bg-accent px-[0.3em] py-[0.14em] text-white">
        VID
        <svg viewBox="0 0 10 12" className="h-[0.62em] w-[0.52em]" aria-hidden>
          <path d="M1 1 L9 6 L1 11 Z" fill="#ffffff" />
        </svg>
      </span>
      <span className="ml-[0.14em] font-bold text-muted">.AI</span>
    </span>
  );
}
