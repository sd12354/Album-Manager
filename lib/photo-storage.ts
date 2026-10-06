/**
 * Shared, secret-free helpers for album photo storage.
 *
 * Photos can live in one of two places:
 *  - Supabase Storage (the original backend), public URL shape:
 *      {SUPABASE_URL}/storage/v1/object/public/album-photos/{key}
 *  - Cloudflare R2 (S3-compatible), public URL shape:
 *      {R2_PUBLIC_URL}/{key}
 *
 * The object key is identical in both: `{ownerId}/{albumId}/{file}`. Keeping
 * the key stable is what lets photos be copied between backends byte for byte
 * and have their links repointed with a simple prefix swap.
 *
 * Nothing in this file touches credentials, so it is safe to import from
 * client components.
 */

export const SUPABASE_PHOTO_BUCKET = "album-photos";

const SUPABASE_PUBLIC_PATH = `/storage/v1/object/public/${SUPABASE_PHOTO_BUCKET}/`;

function trimTrailingSlashes(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/** RFC 3986 encoding for one path segment (stricter than encodeURIComponent). */
export function encodeKeySegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/** Encode an object key for use in a URL path, preserving `/` separators. */
export function encodeKey(key: string): string {
  return key.split("/").map(encodeKeySegment).join("/");
}

function decodeKey(encoded: string): string | null {
  try {
    return encoded.split("/").map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
}

function stripQueryAndHash(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/** Public URL prefix for photos stored in Supabase Storage. */
export function supabasePhotoPrefix(supabaseUrl: string): string {
  return `${trimTrailingSlashes(supabaseUrl)}${SUPABASE_PUBLIC_PATH}`;
}

/**
 * Object key for a Supabase Storage photo URL, or null when the URL is not a
 * Supabase album-photos URL. When `supabaseUrl` is given the host must match.
 */
export function keyFromSupabaseUrl(
  url: string,
  supabaseUrl?: string | null
): string | null {
  const clean = stripQueryAndHash(url);
  if (supabaseUrl) {
    const prefix = supabasePhotoPrefix(supabaseUrl);
    if (!clean.startsWith(prefix)) return null;
    const key = decodeKey(clean.slice(prefix.length));
    return key ? key : null;
  }
  const idx = clean.indexOf(SUPABASE_PUBLIC_PATH);
  if (idx === -1) return null;
  const key = decodeKey(clean.slice(idx + SUPABASE_PUBLIC_PATH.length));
  return key ? key : null;
}

export function isSupabasePhotoUrl(
  url: string,
  supabaseUrl?: string | null
): boolean {
  return keyFromSupabaseUrl(url, supabaseUrl) !== null;
}

/** Public URL for an object key in R2. */
export function r2PublicUrl(publicBaseUrl: string, key: string): string {
  return `${trimTrailingSlashes(publicBaseUrl)}/${encodeKey(key)}`;
}

/** Object key for an R2 public URL, or null when the URL is not under the base. */
export function keyFromR2Url(url: string, publicBaseUrl: string): string | null {
  const prefix = `${trimTrailingSlashes(publicBaseUrl)}/`;
  const clean = stripQueryAndHash(url);
  if (!clean.startsWith(prefix)) return null;
  const key = decodeKey(clean.slice(prefix.length));
  return key ? key : null;
}

/** `{ownerId}/{albumId}` taken from an object key, or null if it has no file part. */
export function parsePhotoKey(
  key: string
): { ownerId: string; albumId: string; file: string } | null {
  const parts = key.split("/");
  if (parts.length < 3) return null;
  const [ownerId, albumId, ...rest] = parts;
  const file = rest.join("/");
  if (!ownerId || !albumId || !file) return null;
  if (parts.some((p) => p === "." || p === "..")) return null;
  return { ownerId, albumId, file };
}

/** True when the key sits in the given album's folder. */
export function keyBelongsToAlbum(
  key: string,
  ownerId: string,
  albumId: string
): boolean {
  const parsed = parsePhotoKey(key);
  return !!parsed && parsed.ownerId === ownerId && parsed.albumId === albumId;
}

/**
 * Build the storage key for a new upload. `safeName` must already be
 * sanitised (see sanitizeFilename in lib/photos.ts).
 */
export function buildPhotoKey(
  ownerId: string,
  albumId: string,
  safeName: string,
  now: number = Date.now(),
  rand: string = Math.random().toString(36).slice(2, 8)
): string {
  return `${ownerId}/${albumId}/${now}-${rand}-${safeName}`;
}
