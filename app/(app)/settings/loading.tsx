import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="animate-fade-in">
      <Skeleton className="h-9 w-32" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`rounded-xl border border-border bg-card p-6 animate-fade-in-up stagger-${i + 1}`}
          >
            <Skeleton className="h-6 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
