import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  contentTypeFor,
  fingerprint,
  md5Hex,
  planMigration,
} from "./photo-migration";

const SUPABASE = "https://ref.supabase.co";
const R2 = "https://pub-example.r2.dev";
const sb = (key: string) =>
  `${SUPABASE}/storage/v1/object/public/album-photos/${key}`;

describe("planMigration", () => {
  const albums = [
    { id: "a1", photo_urls: [sb("o/a1/1-x-front.jpg"), sb("o/a1/2-y-back.jpg")] },
    { id: "a2", photo_urls: [`${R2}/o/a2/3-z-front.jpg`] },
    { id: "a3", photo_urls: null },
    { id: "a4", photo_urls: ["https://elsewhere.example/img.jpg"] },
    // Same file linked twice must only be copied once.
    { id: "a5", photo_urls: [sb("o/a1/1-x-front.jpg")] },
  ];

  it("splits links into pending, already copied, already on R2 and foreign", () => {
    const inR2 = new Map([["o/a1/2-y-back.jpg", { size: 10, etag: "e" }]]);
    const plan = planMigration(albums, SUPABASE, R2, inR2);

    expect(plan.pending).toEqual([
      { albumId: "a1", url: sb("o/a1/1-x-front.jpg"), key: "o/a1/1-x-front.jpg" },
    ]);
    expect(plan.copied.map((p) => p.key)).toEqual(["o/a1/2-y-back.jpg"]);
    expect(plan.linkedToR2).toBe(1);
    expect(plan.otherLinks).toBe(1);
  });

  it("has nothing left to do once every file is in R2", () => {
    const inR2 = new Map([
      ["o/a1/1-x-front.jpg", { size: 1, etag: "a" }],
      ["o/a1/2-y-back.jpg", { size: 2, etag: "b" }],
    ]);
    const plan = planMigration(albums, SUPABASE, R2, inR2);
    expect(plan.pending).toEqual([]);
    expect(plan.copied).toHaveLength(2);
  });

  it("ignores photos from a different Supabase project", () => {
    const foreign = [
      {
        id: "x",
        photo_urls: [
          "https://other.supabase.co/storage/v1/object/public/album-photos/o/x/1.jpg",
        ],
      },
    ];
    const plan = planMigration(foreign, SUPABASE, R2, new Map());
    expect(plan.pending).toEqual([]);
    expect(plan.otherLinks).toBe(1);
  });
});

describe("verification helpers", () => {
  it("fingerprints files independent of input order and ETag case", () => {
    const a = { key: "o/a/1.jpg", size: 5, etag: "ABCDEF" };
    const b = { key: "o/a/2.jpg", size: 7, etag: "123456" };
    const expected = createHash("sha256")
      .update("o/a/1.jpg:5:abcdef\no/a/2.jpg:7:123456", "utf8")
      .digest("hex");

    expect(fingerprint([a, b])).toBe(expected);
    expect(fingerprint([b, a])).toBe(expected);
  });

  it("changes the fingerprint when any file's size or checksum differs", () => {
    const base = [{ key: "k", size: 5, etag: "aa" }];
    expect(fingerprint(base)).not.toBe(fingerprint([{ key: "k", size: 6, etag: "aa" }]));
    expect(fingerprint(base)).not.toBe(fingerprint([{ key: "k", size: 5, etag: "ab" }]));
    expect(fingerprint(base)).not.toBe(fingerprint([]));
  });

  it("computes the MD5 that S3-compatible stores report as the ETag", () => {
    expect(md5Hex(new TextEncoder().encode("hello"))).toBe(
      "5d41402abc4b2a76b9719d911017c592"
    );
  });

  it("keeps the source content type, falling back to the extension", () => {
    expect(contentTypeFor("o/a/1.jpg", "image/jpeg")).toBe("image/jpeg");
    expect(contentTypeFor("o/a/1.PNG", "application/octet-stream")).toBe("image/png");
    expect(contentTypeFor("o/a/1.jpeg", null)).toBe("image/jpeg");
    expect(contentTypeFor("o/a/1.jpg", "image/jpeg; charset=binary")).toBe("image/jpeg");
    expect(contentTypeFor("o/a/noext", null)).toBe("application/octet-stream");
  });
});
