import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/collections";
import { EBAY_MAX_PHOTOS } from "@/lib/photos";
import type { Album } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface AttachItem {
  albumId: string;
  url: string;
}

/**
 * Attaches already-uploaded storage photos to albums. Binaries are uploaded
 * directly from the browser to Supabase Storage, so this endpoint only receives
 * a small JSON list of { albumId, url } pairs — keeping it well clear of the
 * serverless request-body limit even for 100+ photo batches.
 */
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

  let body: { items?: AttachItem[] };
  try {
    body = (await request.json()) as { items?: AttachItem[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "No photos to attach" }, { status: 400 });
  }

  // Only accept URLs that point at our own storage bucket, so a tampered
  // request can't inject arbitrary external image URLs into a listing.
  const expectedPrefix = `${
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  }/storage/v1/object/public/album-photos/`;

  const valid = items.filter(
    (i) =>
      i &&
      typeof i.albumId === "string" &&
      typeof i.url === "string" &&
      i.url.startsWith(expectedPrefix)
  );

  if (valid.length === 0) {
    return NextResponse.json(
      { error: "No valid photo URLs to attach" },
      { status: 400 }
    );
  }

  // Group new URLs by album so each album is updated exactly once.
  const byAlbum = new Map<string, string[]>();
  for (const item of valid) {
    const list = byAlbum.get(item.albumId) ?? [];
    list.push(item.url);
    byAlbum.set(item.albumId, list);
  }

  const albumIds = Array.from(byAlbum.keys());
  const { data: albums, error: albumsError } = await supabase
    .from("albums")
    .select("id, photo_urls")
    .eq("user_id", ctx.ownerId)
    .in("id", albumIds);

  if (albumsError) {
    return NextResponse.json({ error: albumsError.message }, { status: 500 });
  }

  const existingByAlbum = new Map(
    (albums ?? []).map((a) => [
      a.id,
      (a as Pick<Album, "id" | "photo_urls">).photo_urls ?? [],
    ])
  );

  let attached = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [albumId, urls] of Array.from(byAlbum.entries())) {
    const existing = existingByAlbum.get(albumId);
    if (!existing) {
      skipped += urls.length;
      continue;
    }

    const room = EBAY_MAX_PHOTOS - existing.length;
    if (room <= 0) {
      skipped += urls.length;
      continue;
    }

    const toAdd = urls.slice(0, room);
    skipped += urls.length - toAdd.length;
    const merged = [...existing, ...toAdd];

    const { error } = await supabase
      .from("albums")
      .update({ photo_urls: merged })
      .eq("id", albumId)
      .eq("user_id", ctx.ownerId);

    if (error) {
      errors.push(`${albumId}: ${error.message}`);
      skipped += toAdd.length;
      continue;
    }

    attached += toAdd.length;
  }

  console.log("[attach-photos]", {
    event: "batch_complete",
    attached,
    skipped,
    errorCount: errors.length,
  });

  return NextResponse.json({ attached, skipped, errors });
}
