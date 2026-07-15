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
  // The brand wordmark image (public/logo-wordmark.png). Height scales with the
  // font-size set via className (defaults to text-[19px]); width auto-fits.
  return (
    <span className={cn("inline-flex items-center text-[19px] leading-none", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-wordmark.png" alt="VIBVID.AI" className="h-[1.35em] w-auto" draggable={false} />
    </span>
  );
}
