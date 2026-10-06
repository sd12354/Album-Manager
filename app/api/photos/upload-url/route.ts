import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManage, getRoleForOwner } from "@/lib/collections";
import {
  ACCEPTED_MIME_TYPES,
  STORAGE_MAX_FILE_SIZE_MB,
  sanitizeFilename,
} from "@/lib/photos";
import { buildPhotoKey, r2PublicUrl } from "@/lib/photo-storage";
import { getR2Config, presignObjectUpload } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hands the browser a short-lived, single-object upload URL for Cloudflare R2
 * so photo bytes go straight from the device to storage (no re-encoding, and
 * no serverless body-size limit in the way).
 *
 * When R2 is not configured this answers `{ backend: "supabase" }` and the
 * caller uploads to Supabase Storage exactly as before.
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
    return NextResponse.json({ backend: "supabase" });
  }

  const body = (await request.json().catch(() => null)) as {
    albumId?: unknown;
    filename?: unknown;
    contentType?: unknown;
    size?: unknown;
  } | null;

  const albumId = typeof body?.albumId === "string" ? body.albumId : "";
  const filename = typeof body?.filename === "string" ? body.filename : "";
  const contentType =
    typeof body?.contentType === "string" ? body.contentType : "";
  const size = typeof body?.size === "number" ? body.size : NaN;

  if (!albumId || !filename) {
    return NextResponse.json(
      { error: "albumId and filename are required." },
      { status: 400 }
    );
  }
  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(contentType)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use JPEG, PNG, WebP, GIF, BMP, or TIFF." },
      { status: 400 }
    );
  }
  if (
    !Number.isFinite(size) ||
    size <= 0 ||
    size > STORAGE_MAX_FILE_SIZE_MB * 1024 * 1024
  ) {
    return NextResponse.json(
      { error: `Photos must be under ${STORAGE_MAX_FILE_SIZE_MB}MB.` },
      { status: 400 }
    );
  }

  // RLS only returns the album when the caller owns it or it is shared with
  // them; the role check below then requires owner/editor rights.
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
      { error: "You need editor access to add photos to this collection." },
      { status: 403 }
    );
  }

  // The key lives under the collection owner's folder, same layout as before.
  const key = buildPhotoKey(ownerId, album.id as string, sanitizeFilename(filename));
  const upload = presignObjectUpload(config, key, contentType, 300);

  return NextResponse.json({
    backend: "r2",
    uploadUrl: upload.url,
    headers: upload.headers,
    publicUrl: r2PublicUrl(config.publicUrl, key),
  });
}
