import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AlbumDetailClient } from "@/components/album-detail-client";
import {
  canManage,
  getOwnerConnectionStatus,
  getRoleForOwner,
} from "@/lib/collections";
import type { Album, PricingResult } from "@/types";

interface AlbumDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (albumError) {
    // Surface real DB errors instead of silently rendering a 404 — makes
    // RLS / auth / connectivity issues actually diagnosable.
    throw new Error(
      `Failed to load album ${id}: ${albumError.message} (${albumError.code})`
    );
  }

  if (!album) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const typedAlbum = album as Album;
  if (!user) {
    notFound();
  }

  const role = await getRoleForOwner(user, typedAlbum.user_id);
  if (role === "none") {
    notFound();
  }

  const isOwner = typedAlbum.user_id === user.id;
  const canEdit = canManage(role);
  const ownerStatus = await getOwnerConnectionStatus(user, typedAlbum.user_id);

  // Resolve Discogs release ID from album column (migration 004) or pricing cache
  const typedForRelease = album as Album;
  let discogsReleaseId: number | null =
    (typedForRelease as Album & { discogs_release_id?: number | null })
      .discogs_release_id ?? null;

  if (!discogsReleaseId) {
    const { data: discogsCache } = await supabase
      .from("pricing_cache")
      .select("raw_data")
      .eq("album_id", id)
      .eq("source", "discogs")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const raw = (discogsCache?.raw_data ?? {}) as Record<string, unknown>;
    discogsReleaseId = (raw.releaseId as number | undefined) ?? null;
  }

  const { data: cache } = await supabase
    .from("pricing_cache")
    .select("*")
    .eq("album_id", id)
    .order("fetched_at", { ascending: false });

  let initialPricing: PricingResult | null = null;
  if (cache && cache.length > 0) {
    const discogs = cache.find((c) => c.source === "discogs");
    const ebay = cache.find((c) => c.source === "ebay");
    const discogsRaw = (discogs?.raw_data ?? {}) as Record<string, unknown>;
    const ebayRaw = (ebay?.raw_data ?? {}) as Record<string, unknown>;

    let suggestionSource: PricingResult["suggestionSource"] | undefined;
    if (discogsRaw.priceForCondition != null) {
      suggestionSource = "discogs-condition";
    } else if (discogs?.median_price != null) {
      suggestionSource = "discogs-median";
    } else if (ebay?.median_price != null) {
      suggestionSource = "ebay-active";
    }

    initialPricing = {
      discogsMedian: discogs?.median_price ?? undefined,
      discogsLowest: discogs?.lowest_price ?? undefined,
      discogsSalesCount: discogs?.num_sales ?? undefined,
      discogsReleaseId: discogsRaw.releaseId as number | undefined,
      discogsReleaseTitle: discogsRaw.releaseTitle as string | undefined,
      discogsReleaseYear: discogsRaw.releaseYear as string | undefined,
      discogsPriceForCondition: discogsRaw.priceForCondition as
        | number
        | undefined,
      discogsConditionPrices: discogsRaw.allConditionPrices as
        | Record<string, number>
        | undefined,
      ebayMedian: ebay?.median_price ?? undefined,
      ebayLowest: ebay?.lowest_price ?? undefined,
      ebayHighest: ebayRaw.highest as number | undefined,
      ebayComparables: ebayRaw.comparables as number[] | undefined,
      ebayCount: ebay?.num_sales ?? undefined,
      ebaySampleListings: ebayRaw.sampleListings as
        | PricingResult["ebaySampleListings"],
      suggestedPrice: (album as Album).suggested_price ?? 0,
      confidence:
        (discogsRaw.confidence as PricingResult["confidence"]) ?? "medium",
      suggestionSource,
    };
  }

  return (
    <AlbumDetailClient
      album={album as Album}
      ebayConnected={ownerStatus.ebayConnected}
      discogsConnected={ownerStatus.discogsConnected}
      discogsReleaseId={discogsReleaseId}
      initialPricing={initialPricing}
      canEdit={canEdit}
      isOwner={isOwner}
    />
  );
}
