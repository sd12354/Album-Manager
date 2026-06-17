import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManage, getRoleForOwner } from "@/lib/collections";
import { generateListingDescription } from "@/lib/ai-pricing";
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
    return NextResponse.json(
      { error: "AI features are not configured on this server. Add ANTHROPIC_API_KEY to your environment variables." },
      { status: 400 }
    );
  }

  const { albumId, save, platform } = await request.json().catch(() => ({})) as {
    albumId: string;
    save?: boolean;
    platform?: "ebay" | "discogs" | "both";
  };

  if (!albumId) {
    return NextResponse.json({ error: "albumId required" }, { status: 400 });
  }

  const { data: album, error } = await supabase
    .from("albums")
    .select("*")
    .eq("id", albumId)
    .single();

  if (error || !album) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const typedAlbum = album as Album;
  const role = await getRoleForOwner(user, typedAlbum.user_id);
  if (!canManage(role)) {
    return NextResponse.json(
      { error: "You need editor access to generate listing descriptions for this album." },
      { status: 403 }
    );
  }

  // Pull release year from pricing cache if available
  const { data: cacheRow } = await supabase
    .from("pricing_cache")
    .select("raw_data")
    .eq("album_id", albumId)
    .eq("source", "discogs")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const releaseYear =
    (cacheRow?.raw_data as Record<string, unknown> | null)?.releaseYear as string | undefined;

  try {
    const description = await generateListingDescription({
      artist: typedAlbum.artist,
      title: typedAlbum.title,
      genre: typedAlbum.genre,
      condition: typedAlbum.condition as AlbumCondition,
      catalogNumber: typedAlbum.catalog_number,
      notes: typedAlbum.notes,
      releaseYear,
      suggestedPrice: typedAlbum.list_price ?? typedAlbum.suggested_price,
      platform: platform ?? "both",
    });

    // Optionally persist to the album record
    if (save !== false) {
      const { error: updateError } = await supabase
        .from("albums")
        .update({ listing_description: description })
        .eq("id", albumId)
        .eq("user_id", typedAlbum.user_id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ description });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Description generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
