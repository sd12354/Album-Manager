import Link from "next/link";
import { Upload, Plus, DollarSign, ImageIcon, ImageOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SalesChart, type SalesPoint } from "@/components/sales-chart";
import { AnimatedStats } from "@/components/animated-stats";
import { AnimatedCollectionValue } from "@/components/animated-collection-value";
import { WhatsNewCard } from "@/components/whats-new-card";
import { formatRelativeTime, getActivityDescription } from "@/lib/utils";
import { getActiveCollection } from "@/lib/collections";
import { summarizeCollectionValue } from "@/lib/collection-value";
import type { Album, PricingCache } from "@/types";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const active = user ? await getActiveCollection(user) : null;
  const ownerId = active?.ownerId ?? user?.id ?? "";

  const { data: albums } = await supabase
    .from("albums")
    .select("*")
    .eq("user_id", ownerId)
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

  // Collection value = sum of best available price for every non-sold album,
  // with low/high bands from pricing cache where available.
  const unsoldAlbums = allAlbums.filter((a) => a.status !== "sold");
  const unsoldIds = unsoldAlbums.map((a) => a.id);

  let cacheRows: PricingCache[] = [];
  if (unsoldIds.length > 0) {
    const { data } = await supabase
      .from("pricing_cache")
      .select("album_id, source, median_price, lowest_price, raw_data, fetched_at")
      .in("album_id", unsoldIds);
    cacheRows = (data ?? []) as PricingCache[];
  }

  const valueSummary = summarizeCollectionValue(allAlbums, cacheRows);
  const {
    estimatedTotal: collectionValue,
    lowTotal: collectionLow,
    highTotal: collectionHigh,
    pricedCount,
    unpricedCount,
    marketDataCount,
  } = valueSummary;

  const recentActivity = allAlbums.slice(0, 10);
  const monthlySales = buildMonthlySales(allAlbums);

  const withPhotos = allAlbums.filter(
    (a) => Array.isArray(a.photo_urls) && a.photo_urls.length > 0
  ).length;
  const missingPhotos = totalAlbums - withPhotos;
  const photoCoveragePct =
    totalAlbums > 0 ? Math.round((withPhotos / totalAlbums) * 100) : 0;

  const unlistedValue = unsoldAlbums
    .filter((a) => a.status !== "listed")
    .reduce((s, a) => s + (a.list_price ?? a.suggested_price ?? 0), 0);
  const listedValue = unsoldAlbums
    .filter((a) => a.status === "listed")
    .reduce((s, a) => s + (a.list_price ?? a.suggested_price ?? 0), 0);

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-3xl font-bold">Dashboard</h1>

      {/* Animated stat cards */}
      <div className="mt-8">
        <AnimatedStats
          totalAlbums={totalAlbums}
          listedCount={listedCount}
          soldThisMonth={soldThisMonth.length}
          revenueThisMonth={revenueThisMonth}
        />
      </div>

      {/* Animated collection value */}
      <div className="mt-4">
        <AnimatedCollectionValue
          collectionValue={collectionValue}
          collectionLow={collectionLow}
          collectionHigh={collectionHigh}
          pricedCount={pricedCount}
          unpricedCount={unpricedCount}
          marketDataCount={marketDataCount}
          unlistedValue={unlistedValue}
          listedValue={listedValue}
        />
      </div>

      {totalAlbums > 0 && (
        <div className="mt-4 animate-fade-in-up stagger-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold">Album Photos</h2>
                  <p className="text-sm text-muted-foreground">
                    {totalAlbums === 0
                      ? "Add albums to start tracking photo coverage."
                      : `${photoCoveragePct}% of your catalogue has cover photos.`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
                    <ImageIcon className="h-4 w-4" />
                    {withPhotos} with photos
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-400">
                    <ImageOff className="h-4 w-4" />
                    {missingPhotos} missing photos
                  </span>
                  {missingPhotos > 0 && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/albums?missing=photos">View missing</Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-8">
        <SalesChart data={monthlySales} />
      </div>

      <div className="mt-8 animate-fade-in-up stagger-5">
        <WhatsNewCard />
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
                    className={`group flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none animate-fade-in-up stagger-${Math.min(i + 1, 5)}`}
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
