"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface Stat {
  label: string;
  /** Raw numeric value — used for the count-up animation */
  numericValue: number;
  /** Pre-formatted display string (e.g. "$2,340") — shown when isCurrency=true */
  displayValue: string;
  isCurrency: boolean;
  trend: string | null;
}

interface AnimatedStatCardProps {
  stat: Stat;
  index: number;
}

function useCountUp(target: number, duration = 900, enabled = true) {
  const [current, setCurrent] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!enabled || target === 0) {
      setCurrent(target);
      return;
    }
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target));
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      }
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, enabled]);

  return current;
}

function AnimatedStatCard({ stat, index }: AnimatedStatCardProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Trigger animation once the card enters the viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const count = useCountUp(stat.numericValue, 900 + index * 80, visible);

  const displayedValue = stat.isCurrency
    ? formatCurrency(count)
    : count.toLocaleString();

  return (
    <div ref={ref}>
      <Card className={`animate-fade-in-up stagger-${index + 1} transition-colors hover:border-white/[0.12]`}>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">{stat.label}</p>
          <div className="mt-2 flex items-end justify-between">
            <p className="font-display text-3xl font-bold tabular-nums">
              {visible ? displayedValue : (stat.isCurrency ? formatCurrency(0) : "0")}
            </p>
            {stat.trend && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <TrendingUp className="h-3 w-3" />
                {stat.trend}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface AnimatedStatsProps {
  totalAlbums: number;
  listedCount: number;
  soldThisMonth: number;
  revenueThisMonth: number;
}

export function AnimatedStats({
  totalAlbums,
  listedCount,
  soldThisMonth,
  revenueThisMonth,
}: AnimatedStatsProps) {
  const stats: Stat[] = [
    {
      label: "Total Albums",
      numericValue: totalAlbums,
      displayValue: totalAlbums.toLocaleString(),
      isCurrency: false,
      trend: null,
    },
    {
      label: "Listed",
      numericValue: listedCount,
      displayValue: listedCount.toLocaleString(),
      isCurrency: false,
      trend: listedCount > 0 ? "+12%" : null,
    },
    {
      label: "Sold This Month",
      numericValue: soldThisMonth,
      displayValue: soldThisMonth.toLocaleString(),
      isCurrency: false,
      trend: soldThisMonth > 0 ? "+8%" : null,
    },
    {
      label: "Revenue This Month",
      numericValue: revenueThisMonth,
      displayValue: formatCurrency(revenueThisMonth),
      isCurrency: true,
      trend: revenueThisMonth > 0 ? "+15%" : null,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => (
        <AnimatedStatCard key={stat.label} stat={stat} index={i} />
      ))}
    </div>
  );
}
