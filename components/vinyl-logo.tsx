import { Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VinylLogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export function VinylLogo({
  className,
  showText = true,
  size = "md",
}: VinylLogoProps) {
  const iconSize = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-8 w-8" : "h-6 w-6";
  const textSize =
    size === "sm"
      ? "text-lg"
      : size === "lg"
        ? "text-3xl"
        : "text-xl";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Disc3 className={cn(iconSize, "text-accent")} />
      {showText && (
        <span
          className={cn(
            "font-display font-bold tracking-tight text-foreground",
            textSize
          )}
        >
          VinylVault
        </span>
      )}
    </div>
  );
}
