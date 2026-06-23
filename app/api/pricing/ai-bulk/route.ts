import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManage, getRoleForOwner } from "@/lib/collections";
import { getAIPricingSuggestion } from "@/lib/ai-pricing";
import type { Album, AlbumCondition } from "@/types";

// AI pricing for multiple albums in one request. Sonnet + prompt caching
// keeps per-album latency around 2–4s, so 5 albums per request stays well
// under the 60s function ceiling with headroom for the slowest run.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_BULK = 5;

type BulkResult =
  | {
      albumId: string;
      status: "ok";
      suggestedPrice: number;
      strategy: string;
      confidence: string;
    }
  | { albumId: string; status: "skipped"; reason: string }
  | { albumId: string; status: "error"; error: string };

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
      {
        error:
          "AI pricing is not configured on this server. Add ANTHROPIC_API_KEY to your environment variables.",
      },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    albumIds?: string[];
  };
  const albumIds = Array.isArray(body.albumIds) ? body.albumIds : [];
  if (albumIds.length === 0) {
    return NextResponse.json({ error: "albumIds required" }, { status: 400 });
  }
  if (albumIds.length > MAX_BULK) {
    return NextResponse.json(
      {
        error: `AI bulk pricing is capped at ${MAX_BULK} albums per request to stay under the 60s serverless limit. Got ${albumIds.length}.`,
      },
      { status: 400 }
    );
  }

  const results: BulkResult[] = [];

  for (const albumId of albumIds) {
    try {
      const { data: album, error: albumError } = await supabase
        .from("albums")
        .select("*")
        .eq("id", albumId)
        .single();
      if (albumError || !album) {
        results.push({
          albumId,
          status: "error",
          error: albumError?.message ?? "Album not found",
        });
        continue;
      }

      const typedAlbum = album as Album;
      const role = await getRoleForOwner(user, typedAlbum.user_id);
      if (!canManage(role)) {
        results.push({
          albumId,
          status: "skipped",
          reason: "You need editor access for this collection.",
        });
        continue;
      }
      if (typedAlbum.status === "sold") {
        results.push({
          albumId,
          status: "skipped",
          reason: "Album is already sold.",
        });
        continue;
      }

      // Pull whatever market data we already have cached. The AI works fine
      // without it (it falls back to genre knowledge), so a missing cache
      // row isn't a blocker — just less context.
      const { data: cacheRows } = await supabase
        .from("pricing_cache")
        .select("*")
        .eq("album_id", albumId)
        .order("fetched_at", { ascending: false });
      const discogsRow = (cacheRows ?? []).find((r) => r.source === "discogs");
      const ebayRow = (cacheRows ?? []).find((r) => r.source === "ebay");
      const discogsRaw = (discogsRow?.raw_data ?? {}) as Record<string, unknown>;
      const ebayRaw = (ebayRow?.raw_data ?? {}) as Record<string, unknown>;

      const aiResult = await getAIPricingSuggestion({
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
        discogsAllConditionPrices: discogsRaw.allConditionPrices as
          | Record<string, number>
          | undefined,
        discogsReleaseYear: discogsRaw.releaseYear as string | undefined,
        ebayCount: ebayRow?.num_sales ?? undefined,
        ebayMedian: ebayRow?.median_price ?? undefined,
        ebayLowest: ebayRow?.lowest_price ?? undefined,
        ebayHighest: ebayRaw.highest as number | undefined,
        ebaySampleListings: ebayRaw.sampleListings as
          | Array<{ price: number; title: string }>
          | undefined,
        currentSuggestedPrice: typedAlbum.suggested_price ?? undefined,
      });

      const { error: updateError } = await supabase
        .from("albums")
        .update({
          suggested_price: aiResult.suggestedPrice,
          status:
            typedAlbum.status === "unlisted" ? "pricing" : typedAlbum.status,
        })
        .eq("id", albumId)
        .eq("user_id", typedAlbum.user_id);
      if (updateError) {
        results.push({
          albumId,
          status: "error",
          error: `Failed to save AI price: ${updateError.message}`,
        });
        continue;
      }

      results.push({
        albumId,
        status: "ok",
        suggestedPrice: aiResult.suggestedPrice,
        strategy: aiResult.strategy,
        confidence: aiResult.confidence,
      });
    } catch (err) {
      results.push({
        albumId,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ results });
}
