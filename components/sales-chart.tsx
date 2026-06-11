"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export interface SalesPoint {
  /** ISO month key, e.g. "2026-04". Used only for keying — not displayed. */
  monthKey: string;
  /** Short label like "Apr" or "Apr '26". */
  label: string;
  /** Total revenue for that month, in dollars. */
  revenue: number;
  /** Number of items sold that month. */
  count: number;
}

interface SalesChartProps {
  data: SalesPoint[];
}

interface TooltipPayload {
  payload: SalesPoint;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="font-medium text-foreground">{point.label}</p>
      <p className="mt-1 tabular-nums text-accent">
        {formatCurrency(point.revenue)}
      </p>
      <p className="tabular-nums text-muted-foreground">
        {point.count} {point.count === 1 ? "sale" : "sales"}
      </p>
    </div>
  );
}

export function SalesChart({ data }: SalesChartProps) {
  const totalRevenue = data.reduce((sum, p) => sum + p.revenue, 0);
  const totalSales = data.reduce((sum, p) => sum + p.count, 0);
  const hasAnySales = totalSales > 0;

  return (
    <Card className="animate-fade-in-up">
      <CardContent className="p-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Sales Over Time</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Last 12 months
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold tabular-nums">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {totalSales} {totalSales === 1 ? "sale" : "sales"}
            </p>
          </div>
        </div>

        {hasAnySales ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b7fe8" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#8b7fe8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="#64748B"
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748B"
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`
                  }
                  width={48}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{
                    stroke: "rgba(139,127,232,0.25)",
                    strokeWidth: 1,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8b7fe8"
                  strokeWidth={2}
                  fill="url(#salesGradient)"
                  activeDot={{ r: 4, fill: "#8b7fe8", stroke: "#0A0A0B" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
            <p className="text-sm font-medium text-foreground">
              No sales yet
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Once you mark albums as sold, monthly revenue will plot here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
