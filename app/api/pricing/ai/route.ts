import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManage, getRoleForOwner } from "@/lib/collections";
import { getAIPricingSuggestion } from "@/lib/ai-pricing";
import type { Album, AlbumCondition } from "@/types";

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
    // 503 (not 400) — this is a server configuration issue, not a malformed
    // client request. Clients shouldn't retry it as a bad input.
    return NextResponse.json(
      { error: "AI pricing is not configured on this server. Add ANTHROPIC_API_KEY to your environment variables." },
      { status: 503 }
    );
  }

  const { albumId } = await request.json().catch(() => ({}));
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
  const role = await getRoleForOwner(user, typedAlbum.user_id);
  if (!canManage(role)) {
    return NextResponse.json(
      { error: "You need editor access to generate AI pricing for this album." },
      { status: 403 }
    );
  }
  if (typedAlbum.status === "sold") {
    return NextResponse.json(
      { error: "Album is already sold." },
      { status: 409 }
    );
  }

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

    const { error: updateError } = await supabase
      .from("albums")
      .update({
        suggested_price: result.suggestedPrice,
        status: typedAlbum.status === "unlisted" ? "pricing" : typedAlbum.status,
      })
      .eq("id", albumId)
      .eq("user_id", typedAlbum.user_id);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to save AI price: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI pricing failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
