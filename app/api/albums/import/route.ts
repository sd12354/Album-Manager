import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CSVAlbumRow } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const albums: CSVAlbumRow[] = body.albums;

  if (!albums || !Array.isArray(albums) || albums.length === 0) {
    return NextResponse.json({ error: "No albums to import" }, { status: 400 });
  }

  const records = albums.map((album) => ({
    user_id: user.id,
    title: album.title,
    artist: album.artist,
    genre: album.genre ?? null,
    condition: album.condition,
    catalog_number: album.catalog_number ?? null,
    notes: album.notes ?? null,
    purchase_price: album.purchase_price ?? null,
    status: "unlisted" as const,
  }));

  const { data, error } = await supabase.from("albums").insert(records).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: data?.length ?? 0, albums: data });
}
