"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

function useCountUp(target: number, duration = 1100, enabled = true) {
  const [current, setCurrent] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (!enabled || target === 0) { setCurrent(target); return; }
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target * 100) / 100);
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, enabled]);
  return current;
}

interface AnimatedCollectionValueProps {
  collectionValue: number;
  pricedCount: number;
  unpricedCount: number;
  unlistedValue: number;
  listedValue: number;
}

export function AnimatedCollectionValue({
  collectionValue,
  pricedCount,
  unpricedCount,
  unlistedValue,
  listedValue,
}: AnimatedCollectionValueProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const animatedTotal = useCountUp(collectionValue, 1100, visible);
  const animatedUnlisted = useCountUp(unlistedValue, 1000, visible);
  const animatedListed = useCountUp(listedValue, 1000, visible);

  return (
    <div ref={ref}>
      <Card className="animate-fade-in-up stagger-5 transition-colors hover:border-white/[0.12]">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Collection Value</p>
              <p className="mt-1 font-display text-4xl font-bold text-accent tabular-nums">
                {formatCurrency(visible ? animatedTotal : 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Based on {pricedCount} priced album{pricedCount !== 1 ? "s" : ""} in your unsold inventory
                {unpricedCount > 0 && (
                  <> · <span className="text-amber-400">{unpricedCount} still need{unpricedCount === 1 ? "s" : ""} pricing</span></>
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 text-right">
              <div className="flex items-center justify-end gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="text-muted-foreground">Unlisted</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(visible ? animatedUnlisted : 0)}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                <span className="text-muted-foreground">Listed</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(visible ? animatedListed : 0)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
