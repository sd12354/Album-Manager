import { describe, expect, it } from "vitest";
import {
  buildPhotoKey,
  encodeKey,
  isSupabasePhotoUrl,
  keyBelongsToAlbum,
  keyFromR2Url,
  keyFromSupabaseUrl,
  parsePhotoKey,
  r2PublicUrl,
  supabasePhotoPrefix,
} from "./photo-storage";

const SUPABASE = "https://ref.supabase.co";
const R2 = "https://pub-example.r2.dev";
const KEY = "owner-1/album-1/1781190203646-2sxxl2-IMG_7475.jpg";

describe("photo storage URL helpers", () => {
  it("round-trips a key through the Supabase URL shape", () => {
    const url = `${supabasePhotoPrefix(`${SUPABASE}/`)}${KEY}`;
    expect(url).toBe(
      `https://ref.supabase.co/storage/v1/object/public/album-photos/${KEY}`
    );
    expect(keyFromSupabaseUrl(url, SUPABASE)).toBe(KEY);
    expect(keyFromSupabaseUrl(url)).toBe(KEY);
    expect(isSupabasePhotoUrl(url, SUPABASE)).toBe(true);
  });

  it("rejects Supabase URLs from another project or bucket", () => {
    const other = `https://other.supabase.co/storage/v1/object/public/album-photos/${KEY}`;
    expect(keyFromSupabaseUrl(other, SUPABASE)).toBeNull();
    expect(
      keyFromSupabaseUrl(`${SUPABASE}/storage/v1/object/public/avatars/${KEY}`)
    ).toBeNull();
    expect(isSupabasePhotoUrl(`${R2}/${KEY}`)).toBe(false);
  });

  it("round-trips a key through the R2 URL shape, including odd characters", () => {
    const odd = "owner-1/album-1/1-ab-My Cover (1) & more.jpg";
    const url = r2PublicUrl(`${R2}/`, odd);
    expect(url).toBe(
      "https://pub-example.r2.dev/owner-1/album-1/1-ab-My%20Cover%20%281%29%20%26%20more.jpg"
    );
    expect(keyFromR2Url(url, R2)).toBe(odd);
    expect(keyFromR2Url(`${url}?download=1#x`, `${R2}/`)).toBe(odd);
  });

  it("does not treat a look-alike host as the R2 base", () => {
    expect(keyFromR2Url(`https://pub-example.r2.dev.evil.test/${KEY}`, R2)).toBeNull();
    expect(keyFromR2Url(`${R2}`, R2)).toBeNull();
  });

  it("keeps the same key in both backends so links can be prefix-swapped", () => {
    const supabaseUrl = `${supabasePhotoPrefix(SUPABASE)}${encodeKey(KEY)}`;
    const key = keyFromSupabaseUrl(supabaseUrl, SUPABASE);
    expect(key).toBe(KEY);
    expect(r2PublicUrl(R2, key!)).toBe(`${R2}/${KEY}`);
  });

  it("parses and scopes keys to an album folder", () => {
    expect(parsePhotoKey(KEY)).toEqual({
      ownerId: "owner-1",
      albumId: "album-1",
      file: "1781190203646-2sxxl2-IMG_7475.jpg",
    });
    expect(parsePhotoKey("owner-1/album-1")).toBeNull();
    expect(parsePhotoKey("owner-1/../album-1/x.jpg")).toBeNull();
    expect(keyBelongsToAlbum(KEY, "owner-1", "album-1")).toBe(true);
    expect(keyBelongsToAlbum(KEY, "owner-2", "album-1")).toBe(false);
    expect(keyBelongsToAlbum(KEY, "owner-1", "album-2")).toBe(false);
  });

  it("builds upload keys in the established layout", () => {
    expect(buildPhotoKey("o", "a", "cover.jpg", 1700000000000, "abc123")).toBe(
      "o/a/1700000000000-abc123-cover.jpg"
    );
  });
});
