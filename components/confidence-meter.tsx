import { cn } from "@/lib/utils";

interface ConfidenceMeterProps {
  confidence: "low" | "medium" | "high";
  className?: string;
}

const config = {
  low: { label: "Low", textColor: "text-red-400", barColor: "bg-red-400", bars: 1 },
  medium: { label: "Medium", textColor: "text-yellow-400", barColor: "bg-yellow-400", bars: 2 },
  high: { label: "High", textColor: "text-green-400", barColor: "bg-green-400", bars: 3 },
};

export function ConfidenceMeter({ confidence, className }: ConfidenceMeterProps) {
  const { label, textColor, barColor, bars } = config[confidence];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-end gap-0.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "w-1 rounded-sm",
              i <= bars ? barColor : "bg-white/10",
              i === 1 ? "h-2" : i === 2 ? "h-3" : "h-4"
            )}
          />
        ))}
      </div>
      <span className={cn("text-xs font-medium", textColor)}>{label}</span>
    </div>
  );
}
