import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/collections";
import { normalizeCondition } from "@/lib/csv";
import type { CSVAlbumRow } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function validateAlbumRows(rawAlbums: unknown): {
  rows: CSVAlbumRow[];
  errors: string[];
} {
  if (!Array.isArray(rawAlbums)) {
    return { rows: [], errors: ["albums must be an array"] };
  }

  const rows: CSVAlbumRow[] = [];
  const errors: string[] = [];

  rawAlbums.forEach((raw, index) => {
    const rowNum = index + 1;
    if (!raw || typeof raw !== "object") {
      errors.push(`Album ${rowNum}: invalid row`);
      return;
    }

    const album = raw as Record<string, unknown>;
    const title = typeof album.title === "string" ? album.title.trim() : "";
    const artist = typeof album.artist === "string" ? album.artist.trim() : "";
    const condition = normalizeCondition(
      typeof album.condition === "string" ? album.condition : undefined
    );

    if (!title) errors.push(`Album ${rowNum}: missing title`);
    if (!artist) errors.push(`Album ${rowNum}: missing artist`);
    if (!condition) errors.push(`Album ${rowNum}: invalid condition`);

    let purchasePrice: number | undefined;
    if (album.purchase_price != null) {
      const numeric =
        typeof album.purchase_price === "number"
          ? album.purchase_price
          : Number.parseFloat(String(album.purchase_price));
      if (!Number.isFinite(numeric) || numeric < 0) {
        errors.push(`Album ${rowNum}: invalid purchase price`);
      } else {
        purchasePrice = numeric;
      }
    }

    if (!title || !artist || !condition) return;

    rows.push({
      title,
      artist,
      genre: typeof album.genre === "string" ? album.genre.trim() : undefined,
      condition,
      catalog_number:
        typeof album.catalog_number === "string"
          ? album.catalog_number.trim()
          : undefined,
      notes: typeof album.notes === "string" ? album.notes.trim() : undefined,
      purchase_price: purchasePrice,
    });
  });

  return { rows, errors };
}

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
  const { rows: albums, errors } = validateAlbumRows(body.albums);

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Invalid album rows", details: errors.slice(0, 20) },
      { status: 400 }
    );
  }

  if (!albums || !Array.isArray(albums) || albums.length === 0) {
    return NextResponse.json({ error: "No albums to import" }, { status: 400 });
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
