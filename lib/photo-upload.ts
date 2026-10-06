/**
 * Browser-side photo upload / delete / download helpers.
 *
 * Components call these instead of talking to a storage backend directly.
 * The server decides where a photo goes (`/api/photos/upload-url`): Cloudflare
 * R2 when it is configured, otherwise Supabase Storage as before. Either way
 * the original bytes are uploaded untouched: no resizing, no re-encoding.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOriginalPublicUrl, sanitizeFilename } from "@/lib/photos";
import {
  SUPABASE_PHOTO_BUCKET,
  buildPhotoKey,
  isSupabasePhotoUrl,
  keyFromSupabaseUrl,
} from "@/lib/photo-storage";

export interface UploadAlbumPhotoInput {
  supabase: SupabaseClient;
  /** Collection owner. Only used for the Supabase path; R2 keys are derived server-side. */
  ownerId: string;
  albumId: string;
  file: Blob;
  filename: string;
  /** Defaults to the blob's own type, then image/jpeg. */
  contentType?: string;
  /** Abort the R2 request after this long. Defaults to 60s per step. */
  timeoutMs?: number;
}

type UploadTicket =
  | { backend: "supabase" }
  | {
      backend: "r2";
      uploadUrl: string;
      headers: Record<string, string>;
      publicUrl: string;
    };

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`${label} timed out`);
    }
    throw err instanceof Error ? err : new Error(`${label} failed`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Upload one photo at full quality and return its public URL.
 * Throws an Error with a user-presentable message on failure.
 */
export async function uploadAlbumPhoto(
  input: UploadAlbumPhotoInput
): Promise<string> {
  const { supabase, ownerId, albumId, file, filename } = input;
  const contentType = input.contentType || file.type || "image/jpeg";
  const timeoutMs = input.timeoutMs ?? 60_000;

  const ticketRes = await fetchWithTimeout(
    "/api/photos/upload-url",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        albumId,
        filename,
        contentType,
        size: file.size,
      }),
    },
    timeoutMs,
    "Preparing upload"
  );
  const ticket = (await ticketRes.json().catch(() => null)) as
    | (UploadTicket & { error?: string })
    | { error?: string }
    | null;
  if (!ticketRes.ok || !ticket || !("backend" in ticket)) {
    throw new Error(
      (ticket && "error" in ticket && ticket.error) ||
        `Couldn't prepare the upload (${ticketRes.status})`
    );
  }

  if (ticket.backend === "r2") {
    const put = await fetchWithTimeout(
      ticket.uploadUrl,
      { method: "PUT", headers: ticket.headers, body: file },
      timeoutMs,
      "Upload"
    );
    if (!put.ok) {
      throw new Error(`Upload was rejected by storage (${put.status})`);
    }
    return ticket.publicUrl;
  }

  // Supabase Storage (R2 not configured): unchanged behaviour.
  const path = buildPhotoKey(ownerId, albumId, sanitizeFilename(filename));
  const { error } = await supabase.storage
    .from(SUPABASE_PHOTO_BUCKET)
    .upload(path, file, {
      // Preserve the original binary and Content-Type so eBay (and any other
      // consumer) downloads byte-for-byte identical pixels.
      contentType,
      upsert: false,
      cacheControl: "31536000",
    });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage
    .from(SUPABASE_PHOTO_BUCKET)
    .getPublicUrl(path);
  return getOriginalPublicUrl(data.publicUrl);
}

/**
 * Delete the stored file behind a photo URL. Call this only after the URL
 * has been removed from the album row. Throws on failure; callers treat that
 * as non-fatal because the album no longer points at the file.
 */
export async function deleteAlbumPhoto(input: {
  supabase: SupabaseClient;
  albumId: string;
  url: string;
}): Promise<void> {
  const supabaseKey = keyFromSupabaseUrl(input.url);
  if (supabaseKey) {
    const { error } = await input.supabase.storage
      .from(SUPABASE_PHOTO_BUCKET)
      .remove([supabaseKey]);
    if (error) throw new Error(error.message);
    return;
  }

  const res = await fetch("/api/photos/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ albumId: input.albumId, url: input.url }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Delete failed (${res.status})`);
  }
}

/**
 * Fetch a stored photo's original bytes in the browser (downloads, copies).
 *
 * Supabase always answers with permissive CORS headers, so its responses are
 * safe to reuse from the HTTP cache. R2 only adds CORS headers when the
 * request carries an Origin, so a copy cached by a plain <img> tag would be
 * rejected here; skip the cache for anything that is not a Supabase URL.
 */
export async function fetchPhotoBlob(url: string): Promise<Blob> {
  const res = await fetch(url, {
    cache: isSupabasePhotoUrl(url) ? "force-cache" : "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  return res.blob();
}
