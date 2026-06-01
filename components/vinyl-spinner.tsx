import { cn } from "@/lib/utils";

interface VinylSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  label?: string;
}

const sizeMap = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
  xl: "h-16 w-16",
};

export function VinylSpinner({
  size = "md",
  className,
  label,
}: VinylSpinnerProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 24 24"
        className={cn(sizeMap[size], "animate-spin-vinyl text-accent")}
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="11" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeOpacity="0.2" strokeWidth="0.5" />
        <circle cx="12" cy="12" r="6" stroke="currentColor" strokeOpacity="0.2" strokeWidth="0.5" />
        <circle cx="12" cy="12" r="3.5" fill="currentColor" />
        <circle cx="12" cy="12" r="0.8" fill="#0A0A0B" />
        <path
          d="M12 1 A 11 11 0 0 1 23 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {label && (
        <span className="text-sm text-muted-foreground animate-pulse-soft">
          {label}
        </span>
      )}
    </div>
  );
}
