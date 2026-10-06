import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManage, getRoleForOwner } from "@/lib/collections";
import { keyBelongsToAlbum, keyFromR2Url } from "@/lib/photo-storage";
import { deleteObject, getR2Config } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Removes one photo file from Cloudflare R2 after its link has been taken off
 * the album. The browser cannot delete from R2 directly (it holds no storage
 * credentials), so this endpoint does it after checking the caller may edit
 * the album and that the file really sits in that album's folder.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getR2Config();
  if (!config) {
    return NextResponse.json(
      { error: "R2 storage is not configured." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    albumId?: unknown;
    url?: unknown;
  } | null;
  const albumId = typeof body?.albumId === "string" ? body.albumId : "";
  const url = typeof body?.url === "string" ? body.url : "";

  const key = url ? keyFromR2Url(url, config.publicUrl) : null;
  if (!albumId || !key) {
    return NextResponse.json(
      { error: "albumId and a stored photo URL are required." },
      { status: 400 }
    );
  }

  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("id, user_id")
    .eq("id", albumId)
    .maybeSingle();
  if (albumError) {
    return NextResponse.json({ error: albumError.message }, { status: 500 });
  }
  if (!album) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  const ownerId = album.user_id as string;
  const role = await getRoleForOwner(user, ownerId);
  if (!canManage(role)) {
    return NextResponse.json(
      { error: "You need editor access to remove photos from this collection." },
      { status: 403 }
    );
  }
  if (!keyBelongsToAlbum(key, ownerId, album.id as string)) {
    return NextResponse.json(
      { error: "Photo does not belong to this album." },
      { status: 400 }
    );
  }

  // Never delete a file an album still links to. The UI removes the link
  // first, so a remaining reference means something else still needs it.
  const { data: stillUsed, error: usedError } = await supabase
    .from("albums")
    .select("id")
    .contains("photo_urls", [url])
    .limit(1);
  if (usedError) {
    return NextResponse.json({ error: usedError.message }, { status: 500 });
  }
  if (stillUsed && stillUsed.length > 0) {
    return NextResponse.json({ deleted: false, reason: "still-referenced" });
  }

  try {
    await deleteObject(config, key);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 502 }
    );
  }
  return NextResponse.json({ deleted: true });
}
