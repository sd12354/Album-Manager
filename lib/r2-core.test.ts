import { describe, expect, it } from "vitest";
import {
  normalizeEtag,
  objectPath,
  parseListObjectsXml,
  parseR2Config,
  presignListObjects,
  presignObjectUpload,
  presignUrl,
  type R2Config,
} from "./r2-core";

const config: R2Config = {
  host: "abc123.r2.cloudflarestorage.com",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "secret",
  bucket: "vinylvault-photos",
  publicUrl: "https://pub-example.r2.dev",
};

describe("presignUrl (AWS Signature V4)", () => {
  it("reproduces the presigned GET example from the AWS S3 documentation", () => {
    // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    const url = presignUrl({
      method: "GET",
      host: "examplebucket.s3.amazonaws.com",
      path: "/test.txt",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      expiresIn: 86400,
      now: new Date("2013-05-24T00:00:00Z"),
    });

    expect(url).toBe(
      "https://examplebucket.s3.amazonaws.com/test.txt" +
        "?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
        "&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request" +
        "&X-Amz-Date=20130524T000000Z" +
        "&X-Amz-Expires=86400" +
        "&X-Amz-SignedHeaders=host" +
        "&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"
    );
  });

  it("binds extra headers into the signature", () => {
    const base = {
      method: "PUT" as const,
      host: config.host,
      path: "/b/k.jpg",
      region: "auto",
      accessKeyId: "id",
      secretAccessKey: "secret",
      expiresIn: 300,
      now: new Date("2026-10-06T00:00:00Z"),
    };
    const jpeg = presignUrl({ ...base, headers: { "Content-Type": "image/jpeg" } });
    const png = presignUrl({ ...base, headers: { "Content-Type": "image/png" } });

    expect(jpeg).toContain("X-Amz-SignedHeaders=content-type%3Bhost");
    expect(jpeg.split("X-Amz-Signature=")[1]).not.toBe(
      png.split("X-Amz-Signature=")[1]
    );
  });
});

describe("R2 helpers", () => {
  it("treats a partial configuration as not configured", () => {
    expect(parseR2Config({})).toBeNull();
    expect(
      parseR2Config({
        R2_ACCOUNT_ID: "abc123",
        R2_ACCESS_KEY_ID: "id",
        R2_BUCKET: "b",
        R2_PUBLIC_URL: "https://pub-example.r2.dev",
      })
    ).toBeNull();
    // Public URL must be https so stored links are always usable by eBay.
    expect(
      parseR2Config({
        R2_ACCOUNT_ID: "abc123",
        R2_ACCESS_KEY_ID: "id",
        R2_SECRET_ACCESS_KEY: "s",
        R2_BUCKET: "b",
        R2_PUBLIC_URL: "pub-example.r2.dev",
      })
    ).toBeNull();
  });

  it("builds the S3 host from the account id and trims the public URL", () => {
    expect(
      parseR2Config({
        R2_ACCOUNT_ID: " abc123 ",
        R2_ACCESS_KEY_ID: "id",
        R2_SECRET_ACCESS_KEY: "s",
        R2_BUCKET: "b",
        R2_PUBLIC_URL: "https://pub-example.r2.dev/",
      })
    ).toEqual({
      host: "abc123.r2.cloudflarestorage.com",
      accessKeyId: "id",
      secretAccessKey: "s",
      bucket: "b",
      publicUrl: "https://pub-example.r2.dev",
    });
  });

  it("accepts an explicit endpoint for jurisdiction-specific buckets", () => {
    const parsed = parseR2Config({
      R2_ENDPOINT: "https://abc123.eu.r2.cloudflarestorage.com/",
      R2_ACCESS_KEY_ID: "id",
      R2_SECRET_ACCESS_KEY: "s",
      R2_BUCKET: "b",
      R2_PUBLIC_URL: "https://photos.example.com",
    });
    expect(parsed?.host).toBe("abc123.eu.r2.cloudflarestorage.com");
  });

  it("encodes object keys segment by segment", () => {
    expect(objectPath(config, "owner/album/17-ab-My Cover (1).jpg")).toBe(
      "/vinylvault-photos/owner/album/17-ab-My%20Cover%20%281%29.jpg"
    );
  });

  it("presigns uploads against the bucket with type and cache headers signed", () => {
    const { url, headers } = presignObjectUpload(
      config,
      "owner/album/1-x-cover.jpg",
      "image/jpeg",
      300,
      new Date("2026-10-06T12:00:00Z")
    );
    expect(url.startsWith(
      "https://abc123.r2.cloudflarestorage.com/vinylvault-photos/owner/album/1-x-cover.jpg?"
    )).toBe(true);
    expect(url).toContain("X-Amz-SignedHeaders=cache-control%3Bcontent-type%3Bhost");
    expect(url).toContain("%2F20261006%2Fauto%2Fs3%2Faws4_request");
    expect(headers).toEqual({
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": "image/jpeg",
    });
  });

  it("sorts list query parameters canonically", () => {
    const url = presignListObjects(config, "owner/", "tok/en", 60, new Date(0));
    const query = url.split("?")[1].split("&X-Amz-Signature=")[0];
    const names = query.split("&").map((p) => p.split("=")[0]);
    expect(names).toEqual([...names].sort());
    expect(query).toContain("prefix=owner%2F");
    expect(query).toContain("continuation-token=tok%2Fen");
  });

  it("parses ListObjectsV2 XML including escaped keys and paging", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult><Name>b</Name>
<Contents><Key>o/a/1-x-rock &amp; roll.jpg</Key><Size>2127613</Size><ETag>&quot;0f343b0931126a20f133d67c2b018a3b&quot;</ETag></Contents>
<Contents><Key>o/a/2-y-b.png</Key><Size>42</Size><ETag>"abc"</ETag></Contents>
<IsTruncated>true</IsTruncated><NextContinuationToken>next==</NextContinuationToken>
</ListBucketResult>`;
    expect(parseListObjectsXml(xml)).toEqual({
      objects: [
        {
          key: "o/a/1-x-rock & roll.jpg",
          size: 2127613,
          etag: "0f343b0931126a20f133d67c2b018a3b",
        },
        { key: "o/a/2-y-b.png", size: 42, etag: "abc" },
      ],
      nextToken: "next==",
    });
    expect(
      parseListObjectsXml("<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>")
    ).toEqual({ objects: [], nextToken: null });
  });

  it("normalises ETags", () => {
    expect(normalizeEtag('"abc"')).toBe("abc");
    expect(normalizeEtag('W/"abc"')).toBe("abc");
    expect(normalizeEtag(null)).toBe("");
  });
});
