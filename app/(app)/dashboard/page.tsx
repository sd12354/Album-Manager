import Link from "next/link";
import { Upload, Plus, DollarSign, ImageIcon, ImageOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SalesChart, type SalesPoint } from "@/components/sales-chart";
import { AnimatedStats } from "@/components/animated-stats";
import { AnimatedCollectionValue } from "@/components/animated-collection-value";
import { WhatsNewCard } from "@/components/whats-new-card";
import { DashboardSearch } from "@/components/dashboard-search";
import { RearrangeableDashboard, type DashboardSection } from "@/components/rearrangeable-dashboard";
import { fetchAllPages, fetchAllPagesParallel } from "@/lib/paginate";
import { formatRelativeTime, getActivityDescription } from "@/lib/utils";
import { canManage, getActiveCollection } from "@/lib/collections";
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
  const canEdit = canManage(active?.role ?? null);

  // ── DATA LOAD ───────────────────────────────────────────────────────────
  // 1) Tight projection on albums (no SELECT *).
  // 2) Embed pricing_cache via PostgREST relational select — single round
  //    trip instead of a separate .in(album_id, [1500 UUIDs]) request that
  //    blew past URL-length limits and made the dashboard hang.
  // 3) Count-then-parallel pagination so 2-page fetches happen wall-clock
  //    once instead of twice.
  const DASHBOARD_COLUMNS =
    "id, title, artist, status, sold_at, sold_price, list_price, suggested_price, photo_urls, updated_at, user_id, pricing_cache(album_id, source, median_price, lowest_price)";

  type DashboardAlbum = Pick<
    Album,
    | "id"
    | "title"
    | "artist"
    | "status"
    | "sold_at"
    | "sold_price"
    | "list_price"
    | "suggested_price"
    | "photo_urls"
    | "updated_at"
    | "user_id"
  > & { pricing_cache?: Array<Pick<PricingCache, "album_id" | "source" | "median_price" | "lowest_price">> };

  const { count: albumCount } = await supabase
    .from("albums")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ownerId);

  let albumsWithCache: DashboardAlbum[] = [];
  try {
    if (albumCount != null) {
      albumsWithCache = await fetchAllPagesParallel<DashboardAlbum>(
        (from, to) =>
          supabase
            .from("albums")
            .select(DASHBOARD_COLUMNS)
            .eq("user_id", ownerId)
            .order("updated_at", { ascending: false })
            .range(from, to),
        albumCount
      );
    } else {
      // Fallback: count failed, walk sequentially.
      albumsWithCache = await fetchAllPages<DashboardAlbum>((from, to) =>
        supabase
          .from("albums")
          .select(DASHBOARD_COLUMNS)
          .eq("user_id", ownerId)
          .order("updated_at", { ascending: false })
          .range(from, to)
      );
    }
  } catch {
    albumsWithCache = [];
  }

  // Cast back to Album for downstream consumers — we only read the dashboard
  // fields, so unread Album properties being undefined doesn't matter.
  const allAlbums = albumsWithCache as unknown as Album[];
  const totalAlbums = allAlbums.length;
  const listedCount = allAlbums.filter((a) => a.status === "listed").length;
  const soldThisMonth = allAlbums.filter(
    (a) => a.status === "sold" && a.sold_at && a.sold_at >= startOfMonth
  );
  const revenueThisMonth = soldThisMonth.reduce(
    (sum, a) => sum + (a.sold_price ?? 0),
    0
  );

  // Pull the embedded pricing_cache rows out of each album. No extra round
  // trip, no .in() clause, no URL-length issue.
  const cacheRows: PricingCache[] = albumsWithCache.flatMap((a) =>
    (a.pricing_cache ?? []).map(
      (r) =>
        ({
          album_id: r.album_id,
          source: r.source,
          median_price: r.median_price,
          lowest_price: r.lowest_price,
          // raw_data isn't fetched on the dashboard (only `highest` was used
          // and a slight under-estimate of the high band is an acceptable
          // trade-off for the load-time win).
          raw_data: null,
          fetched_at: "",
          id: "",
        }) as unknown as PricingCache
    )
  );

  const unsoldAlbums = allAlbums.filter((a) => a.status !== "sold");

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
  // Never round up to 100% while any album is still missing a photo (e.g.
  // 336/337 = 99.7% used to display "100%" which contradicted the
  // "1 missing photos" badge next to it).
  const photoCoveragePct =
    totalAlbums === 0
      ? 0
      : missingPhotos === 0
        ? 100
        : Math.min(99, Math.floor((withPhotos / totalAlbums) * 100));

  const unlistedValue = unsoldAlbums
    .filter((a) => a.status !== "listed")
    .reduce((s, a) => s + (a.list_price ?? a.suggested_price ?? 0), 0);
  const listedValue = unsoldAlbums
    .filter((a) => a.status === "listed")
    .reduce((s, a) => s + (a.list_price ?? a.suggested_price ?? 0), 0);

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-3xl font-bold">Dashboard</h1>

      {/* Global search — albums, pages, and actions in one place.
          Cmd+K from anywhere on the dashboard focuses it. */}
      <div className="mt-6">
        <DashboardSearch
          albums={allAlbums.map((a) => ({
            id: a.id,
            title: a.title,
            artist: a.artist,
            status: a.status,
            list_price: a.list_price,
            suggested_price: a.suggested_price,
          }))}
        />
      </div>

      <RearrangeableDashboard
        sections={buildSections({
          totalAlbums,
          listedCount,
          soldThisMonthCount: soldThisMonth.length,
          revenueThisMonth,
          collectionValue,
          collectionLow,
          collectionHigh,
          pricedCount,
          unpricedCount,
          marketDataCount,
          unlistedValue,
          listedValue,
          withPhotos,
          missingPhotos,
          photoCoveragePct,
          monthlySales,
          recentActivity,
          canEdit,
        })}
      />
    </div>
  );
}

interface SectionInput {
  totalAlbums: number;
  listedCount: number;
  soldThisMonthCount: number;
  revenueThisMonth: number;
  collectionValue: number;
  collectionLow: number;
  collectionHigh: number;
  pricedCount: number;
  unpricedCount: number;
  marketDataCount: number;
  unlistedValue: number;
  listedValue: number;
  withPhotos: number;
  missingPhotos: number;
  photoCoveragePct: number;
  monthlySales: SalesPoint[];
  recentActivity: Album[];
  canEdit: boolean;
}

function buildSections(input: SectionInput): DashboardSection[] {
  const sections: DashboardSection[] = [
    {
      id: "stats",
      label: "Stats",
      node: (
        <AnimatedStats
          totalAlbums={input.totalAlbums}
          listedCount={input.listedCount}
          soldThisMonth={input.soldThisMonthCount}
          revenueThisMonth={input.revenueThisMonth}
        />
      ),
    },
    {
      id: "collection-value",
      label: "Collection Value",
      node: (
        <AnimatedCollectionValue
          collectionValue={input.collectionValue}
          collectionLow={input.collectionLow}
          collectionHigh={input.collectionHigh}
          pricedCount={input.pricedCount}
          unpricedCount={input.unpricedCount}
          marketDataCount={input.marketDataCount}
          unlistedValue={input.unlistedValue}
          listedValue={input.listedValue}
        />
      ),
    },
  ];

  if (input.totalAlbums > 0) {
    sections.push({
      id: "photo-coverage",
      label: "Album Photos",
      node: (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold">Album Photos</h2>
                <p className="text-sm text-muted-foreground">
                  {`${input.photoCoveragePct}% of your catalogue has cover photos.`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
                  <ImageIcon className="h-4 w-4" />
                  {input.withPhotos} with photo{input.withPhotos === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-400">
                  <ImageOff className="h-4 w-4" />
                  {input.missingPhotos} missing photo
                  {input.missingPhotos === 1 ? "" : "s"}
                </span>
                {input.missingPhotos > 0 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/albums?missing=photos">View missing</Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ),
    });
  }

  sections.push(
    {
      id: "sales-chart",
      label: "Sales Chart",
      node: <SalesChart data={input.monthlySales} />,
    },
    {
      id: "whats-new",
      label: "What's New",
      node: <WhatsNewCard />,
    },
    {
      id: "quick-actions",
      label: "Quick Actions",
      node: (
        <div>
          <h2 className="mb-4 font-display text-xl font-bold">Quick Actions</h2>
          {input.canEdit ? (
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
          ) : (
            <p className="text-sm text-muted-foreground">
              This shared collection is view-only. Ask the owner for editor
              access to import, add, or price albums.
            </p>
          )}
        </div>
      ),
    },
    {
      id: "recent-activity",
      label: "Recent Activity",
      node: (
        <div>
          <h2 className="mb-4 font-display text-xl font-bold">Recent Activity</h2>
          <Card>
            <CardContent className="p-0">
              {input.recentActivity.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-muted-foreground">No activity yet.</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Import your catalogue or add an album to get started.
                  </p>
                  {input.canEdit ? (
                    <Button className="mt-4" asChild>
                      <Link href="/import">Import CSV</Link>
                    </Button>
                  ) : (
                    <p className="mt-4 text-xs text-muted-foreground">
                      You have view-only access to this collection.
                    </p>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-white/8">
                  {input.recentActivity.map((album) => (
                    <Link
                      key={album.id}
                      href={`/albums/${album.id}`}
                      className="group flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
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
      ),
    }
  );

  return sections;
}
