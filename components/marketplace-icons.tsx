import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
}

/** Simplified eBay wordmark for compact UI (e.g. collapsed sidebar). */
export function EbayMark({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 36 14"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <text
        x="0"
        y="11"
        fontSize="12"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        <tspan fill="#E53238">e</tspan>
        <tspan fill="#0064D2">B</tspan>
        <tspan fill="#F5AF02">a</tspan>
        <tspan fill="#86B817">y</tspan>
      </text>
    </svg>
  );
}

/** Discogs-style record mark for compact UI. */
export function DiscogsMark({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("shrink-0", className)}
      aria-hidden
      fill="currentColor"
    >
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path
        d="M12 2a10 10 0 0 1 0 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.55"
      />
      <path
        d="M12 4a8 8 0 0 1 0 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.35"
      />
    </svg>
  );
}
