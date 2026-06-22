import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CHANGELOG } from "@/lib/changelog";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function WhatsNewCard() {
  const entries = CHANGELOG.slice(0, 2);
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Sparkles className="h-4 w-4" />
          </span>
          <h2 className="font-display text-lg font-bold">What&apos;s new</h2>
        </div>

        <div className="mt-4 space-y-5">
          {entries.map((entry) => (
            <div key={entry.date}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{entry.title}</p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(entry.date)}
                </span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {entry.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-muted-foreground leading-relaxed"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
