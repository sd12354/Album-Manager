import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AlbumDetailClient } from "@/components/album-detail-client";
import {
  canManage,
  getOwnerConnectionStatus,
  getRoleForOwner,
} from "@/lib/collections";
import { buildPricingFromCacheRows } from "@/lib/pricing-cache";
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
  if (!role) {
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
    initialPricing = buildPricingFromCacheRows(
      cache,
      typedAlbum.condition,
      typedAlbum.suggested_price
    );
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
