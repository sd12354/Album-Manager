import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  appendPhotosToAlbumRecord,
  uploadPhotosToAlbum,
} from "@/lib/upload-album-photos";
import { ACCEPTED_MIME_TYPES } from "@/lib/photos";
import type { Album } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

interface AttachItem {
  albumId: string;
  fileIndex: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const itemsRaw = formData.get("items");

  if (typeof itemsRaw !== "string") {
    return NextResponse.json({ error: "items JSON is required" }, { status: 400 });
  }

  let items: AttachItem[];
  try {
    items = JSON.parse(itemsRaw) as AttachItem[];
  } catch {
    return NextResponse.json({ error: "Invalid items JSON" }, { status: 400 });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No photos to attach" }, { status: 400 });
  }

  const albumIds = Array.from(new Set(items.map((i) => i.albumId)));
  const { data: albums, error: albumsError } = await supabase
    .from("albums")
    .select("id, photo_urls")
    .eq("user_id", user.id)
    .in("id", albumIds);

  if (albumsError) {
    return NextResponse.json({ error: albumsError.message }, { status: 500 });
  }

  const albumMap = new Map(
    (albums ?? []).map((a) => [a.id, a as Pick<Album, "id" | "photo_urls">])
  );

  const results: Array<{
    albumId: string;
    fileIndex: number;
    ok: boolean;
    error?: string;
    photoCount?: number;
  }> = [];

  for (const item of items) {
    const album = albumMap.get(item.albumId);
    if (!album) {
      results.push({
        albumId: item.albumId,
        fileIndex: item.fileIndex,
        ok: false,
        error: "Album not found",
      });
      continue;
    }

    const file = formData.get(`file_${item.fileIndex}`);
    if (!(file instanceof File)) {
      results.push({
        albumId: item.albumId,
        fileIndex: item.fileIndex,
        ok: false,
        error: "Photo file missing",
      });
      continue;
    }

    if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
      results.push({
        albumId: item.albumId,
        fileIndex: item.fileIndex,
        ok: false,
        error: "Unsupported image type",
      });
      continue;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const existing = album.photo_urls ?? [];
      const { urls, errors } = await uploadPhotosToAlbum(supabase, {
        userId: user.id,
        albumId: album.id,
        existingUrls: existing,
        photos: [{ buffer, mimeType: file.type, filename: file.name }],
      });

      if (urls.length === 0) {
        results.push({
          albumId: item.albumId,
          fileIndex: item.fileIndex,
          ok: false,
          error: errors[0] ?? "Upload failed",
        });
        continue;
      }

      await appendPhotosToAlbumRecord(supabase, album.id, existing, urls);
      album.photo_urls = [...existing, ...urls].slice(0, 24);

      results.push({
        albumId: item.albumId,
        fileIndex: item.fileIndex,
        ok: true,
        photoCount: urls.length,
      });
    } catch (err) {
      results.push({
        albumId: item.albumId,
        fileIndex: item.fileIndex,
        ok: false,
        error: err instanceof Error ? err.message : "Attach failed",
      });
    }
  }

  const attached = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log("[attach-photos]", {
    event: "batch_complete",
    attached,
    failed,
  });

  return NextResponse.json({ attached, failed, results });
}
