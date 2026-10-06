/**
 * Planning and verification logic for moving album photos from Supabase
 * Storage to Cloudflare R2. Pure functions only: the route in
 * app/api/photos/migrate does the network work.
 *
 * The move is deliberately split in two:
 *  1. COPY  each original file to R2 under the same key, unchanged, and prove
 *     the copy with a checksum. Album links are not touched.
 *  2. FLIP  the links from the Supabase prefix to the R2 prefix once every
 *     file is accounted for (one SQL statement, reversible).
 * Nothing is deleted from Supabase by any of this.
 */
import { createHash } from "node:crypto";
// Relative import (not "@/…") so this module also loads under plain vitest.
import { keyFromR2Url, keyFromSupabaseUrl } from "./photo-storage";

export interface AlbumPhotoRow {
  id: string;
  photo_urls: string[] | null;
}

export interface StoredObject {
  size: number;
  etag: string;
}

export interface SourcePhoto {
  albumId: string;
  url: string;
  key: string;
}

export interface MigrationPlan {
  /** Photos still linked to Supabase whose file is not in R2 yet. */
  pending: SourcePhoto[];
  /** Photos still linked to Supabase whose file is already in R2. */
  copied: SourcePhoto[];
  /** Links that already point at R2. */
  linkedToR2: number;
  /** Links that point somewhere else entirely (left alone). */
  otherLinks: number;
}

export function planMigration(
  albums: AlbumPhotoRow[],
  supabaseUrl: string,
  r2PublicUrl: string,
  inR2: ReadonlyMap<string, StoredObject>
): MigrationPlan {
  const plan: MigrationPlan = {
    pending: [],
    copied: [],
    linkedToR2: 0,
    otherLinks: 0,
  };
  const seen = new Set<string>();

  for (const album of albums) {
    for (const url of album.photo_urls ?? []) {
      if (keyFromR2Url(url, r2PublicUrl)) {
        plan.linkedToR2 += 1;
        continue;
      }
      const key = keyFromSupabaseUrl(url, supabaseUrl);
      if (!key) {
        plan.otherLinks += 1;
        continue;
      }
      // Two albums could in theory share one file; copy it once.
      if (seen.has(key)) continue;
      seen.add(key);
      const photo = { albumId: album.id, url, key };
      if (inR2.has(key)) plan.copied.push(photo);
      else plan.pending.push(photo);
    }
  }
  return plan;
}

/**
 * One hash that stands for "these exact files": every key with its byte size
 * and MD5, in key order. Computing the same value from Supabase's own records
 * and comparing proves all files arrived unchanged without downloading them
 * again.
 *
 * Line format: `{key}:{size}:{md5}` joined with "\n", keys in ascending
 * code-unit order (matches Postgres `ORDER BY name COLLATE "C"` for the ASCII
 * keys this app generates).
 */
export function fingerprint(
  entries: Array<{ key: string; size: number; etag: string }>
): string {
  const lines = [...entries]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((e) => `${e.key}:${e.size}:${e.etag.toLowerCase()}`);
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

/** MD5 hex of a file's bytes: what S3-compatible stores report as the ETag. */
export function md5Hex(bytes: Uint8Array): string {
  return createHash("md5").update(bytes).digest("hex");
}

const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

/** Content type to store: what the source reported, else by file extension. */
export function contentTypeFor(key: string, reported: string | null): string {
  const clean = (reported ?? "").split(";")[0].trim().toLowerCase();
  if (clean.startsWith("image/")) return clean;
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return TYPE_BY_EXTENSION[ext] ?? "application/octet-stream";
}
