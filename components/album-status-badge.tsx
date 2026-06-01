import { cn } from "@/lib/utils";
import type { AlbumStatus } from "@/types";

const statusStyles: Record<AlbumStatus, string> = {
  unlisted: "bg-[#1A1A1C] text-muted-foreground border-white/10",
  pricing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  listed: "bg-green-500/10 text-green-400 border-green-500/20",
  sold: "bg-slate-500/10 text-slate-300 border-slate-500/20",
};

interface AlbumStatusBadgeProps {
  status: AlbumStatus;
  className?: string;
}

export function AlbumStatusBadge({ status, className }: AlbumStatusBadgeProps) {
  const label =
    status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        statusStyles[status],
        className
      )}
    >
      {label}
    </span>
  );
}
