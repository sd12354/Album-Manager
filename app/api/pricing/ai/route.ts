import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIPricingSuggestion } from "@/lib/ai-pricing";
import type { Album, AlbumCondition, PricingResult } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI pricing is not configured on this server. Add ANTHROPIC_API_KEY to your environment variables." },
      { status: 400 }
    );
  }

  const { albumId } = await request.json();
  if (!albumId) {
    return NextResponse.json({ error: "albumId required" }, { status: 400 });
  }

  // Fetch album
  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("*")
    .eq("id", albumId)
    .single();

  if (albumError || !album) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const typedAlbum = album as Album;

  // Pull the latest pricing cache to give the AI real market context
  const { data: cacheRows } = await supabase
    .from("pricing_cache")
    .select("*")
    .eq("album_id", albumId)
    .order("fetched_at", { ascending: false });

  const discogsRow = (cacheRows ?? []).find((r) => r.source === "discogs");
  const ebayRow = (cacheRows ?? []).find((r) => r.source === "ebay");
  const discogsRaw = (discogsRow?.raw_data ?? {}) as Record<string, unknown>;
  const ebayRaw = (ebayRow?.raw_data ?? {}) as Record<string, unknown>;

  // Build a rough PricingResult to get currentSuggestedPrice
  const currentSuggestedPrice = typedAlbum.suggested_price ?? undefined;

  try {
    const result = await getAIPricingSuggestion({
      artist: typedAlbum.artist,
      title: typedAlbum.title,
      genre: typedAlbum.genre,
      condition: typedAlbum.condition as AlbumCondition,
      catalogNumber: typedAlbum.catalog_number,
      notes: typedAlbum.notes,
      discogsNumForSale: discogsRow?.num_sales ?? undefined,
      discogsLowest: discogsRow?.lowest_price ?? undefined,
      discogsMedian: discogsRow?.median_price ?? undefined,
      discogsPriceForCondition: discogsRaw.priceForCondition as number | undefined,
      discogsAllConditionPrices: discogsRaw.allConditionPrices as Record<string, number> | undefined,
      discogsReleaseYear: discogsRaw.releaseYear as string | undefined,
      ebayCount: ebayRow?.num_sales ?? undefined,
      ebayMedian: ebayRow?.median_price ?? undefined,
      ebayLowest: ebayRow?.lowest_price ?? undefined,
      ebayHighest: ebayRaw.highest as number | undefined,
      ebaySampleListings: ebayRaw.sampleListings as Array<{ price: number; title: string }> | undefined,
      currentSuggestedPrice,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI pricing failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
