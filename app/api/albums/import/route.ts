import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/collections";
import type { AlbumCondition, CSVAlbumRow } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const VALID_CONDITIONS = new Set<AlbumCondition>([
  "Mint",
  "Great",
  "Good",
  "Fair",
  "Poor",
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const ctx = await getActiveContext();

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ctx.canEdit) {
    return NextResponse.json(
      { error: "You have view-only access to this collection." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const albums: CSVAlbumRow[] = body.albums;

  if (!albums || !Array.isArray(albums) || albums.length === 0) {
    return NextResponse.json({ error: "No albums to import" }, { status: 400 });
  }

  const invalidCondition = albums.find(
    (album) => !VALID_CONDITIONS.has(album.condition)
  );
  if (invalidCondition) {
    return NextResponse.json(
      {
        error: `Invalid condition "${invalidCondition.condition}". Use Mint, Great, Good, Fair, or Poor.`,
      },
      { status: 400 }
    );
  }

  const records = albums.map((album) => ({
    user_id: ctx.ownerId,
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
