import { cn } from "@/lib/utils";
import type { AlbumCondition } from "@/types";

const conditionStyles: Record<AlbumCondition, string> = {
  Mint: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Great: "bg-green-500/10 text-green-400 border-green-500/20",
  Good: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Fair: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Poor: "bg-red-500/10 text-red-400 border-red-500/20",
};

interface ConditionBadgeProps {
  condition: AlbumCondition;
  className?: string;
}

export function ConditionBadge({ condition, className }: ConditionBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        conditionStyles[condition],
        className
      )}
    >
      {condition}
    </span>
  );
}
