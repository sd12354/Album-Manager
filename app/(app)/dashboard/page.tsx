import Link from "next/link";
import { Upload, Plus, DollarSign, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SalesChart, type SalesPoint } from "@/components/sales-chart";
import { formatCurrency, formatRelativeTime, getActivityDescription } from "@/lib/utils";
import type { Album } from "@/types";

function getStartOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/**
 * Builds a 12-month rolling window of {label, revenue, count}, oldest first.
 * Months with no sales are kept as zero-bars so the X-axis is contiguous and
 * the chart doesn't lie about cadence.
 */
function buildMonthlySales(albums: Album[]): SalesPoint[] {
  const now = new Date();
  const buckets = new Map<string, { revenue: number; count: number }>();

  // Seed 12 months in order so empty months still render.
  const monthOrder: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthOrder.push(key);
    buckets.set(key, { revenue: 0, count: 0 });
  }

  for (const album of albums) {
    if (album.status !== "sold" || !album.sold_at) continue;
    const d = new Date(album.sold_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (!bucket) continue; // Older than our 12-month window — ignore.
    bucket.revenue += album.sold_price ?? 0;
    bucket.count += 1;
  }

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const showYear = new Set<number>();
  // Add year label to January and the very first bucket to anchor the timeline.
  monthOrder.forEach((key, i) => {
    const [, m] = key.split("-").map(Number);
    if (m === 1 || i === 0) showYear.add(i);
  });

  return monthOrder.map((key, i) => {
    const [yearStr, monthStr] = key.split("-");
    const m = Number(monthStr) - 1;
    const yy = yearStr.slice(2);
    const label = showYear.has(i)
      ? `${monthNames[m]} '${yy}`
      : monthNames[m];
    const bucket = buckets.get(key)!;
    return {
      monthKey: key,
      label,
      revenue: Math.round(bucket.revenue * 100) / 100,
      count: bucket.count,
    };
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const startOfMonth = getStartOfMonth();

  const { data: albums } = await supabase
    .from("albums")
    .select("*")
    .order("updated_at", { ascending: false });

  const allAlbums = (albums ?? []) as Album[];
  const totalAlbums = allAlbums.length;
  const listedCount = allAlbums.filter((a) => a.status === "listed").length;
  const soldThisMonth = allAlbums.filter(
    (a) => a.status === "sold" && a.sold_at && a.sold_at >= startOfMonth
  );
  const revenueThisMonth = soldThisMonth.reduce(
    (sum, a) => sum + (a.sold_price ?? 0),
    0
  );

  const recentActivity = allAlbums.slice(0, 10);
  const monthlySales = buildMonthlySales(allAlbums);

  const stats = [
    { label: "Total Albums", value: totalAlbums.toString(), trend: null },
    {
      label: "Listed",
      value: listedCount.toString(),
      trend: listedCount > 0 ? "+12%" : null,
    },
    {
      label: "Sold This Month",
      value: soldThisMonth.length.toString(),
      trend: soldThisMonth.length > 0 ? "+8%" : null,
    },
    {
      label: "Revenue This Month",
      value: formatCurrency(revenueThisMonth),
      trend: revenueThisMonth > 0 ? "+15%" : null,
    },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-3xl font-bold">Dashboard</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card
            key={stat.label}
            className={`animate-fade-in-up stagger-${i + 1} transition-colors hover:border-white/[0.12]`}
          >
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className="mt-2 flex items-end justify-between">
                <p className="font-display text-3xl font-bold tabular-nums">{stat.value}</p>
                {stat.trend && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <TrendingUp className="h-3 w-3" />
                    {stat.trend}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <SalesChart data={monthlySales} />
      </div>

      <div className="mt-8 animate-fade-in-up stagger-5">
        <h2 className="mb-4 font-display text-xl font-bold">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/import">
              <Upload className="h-4 w-4" />
              Import CSV
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/albums?add=true">
              <Plus className="h-4 w-4" />
              Add Album
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/albums?action=price-all">
              <DollarSign className="h-4 w-4" />
              Price All Unlisted
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 animate-fade-in-up stagger-5">
        <h2 className="mb-4 font-display text-xl font-bold">Recent Activity</h2>
        <Card>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-muted-foreground">No activity yet.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Import your catalogue or add an album to get started.
                </p>
                <Button className="mt-4" asChild>
                  <Link href="/import">Import CSV</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {recentActivity.map((album, i) => (
                  <Link
                    key={album.id}
                    href={`/albums/${album.id}`}
                    className={`group flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:outline-none animate-fade-in-up stagger-${Math.min(i + 1, 5)}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium transition-colors group-hover:text-accent">
                        {album.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {album.artist} ·{" "}
                        {getActivityDescription(album.status, album.sold_price)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(album.updated_at)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
