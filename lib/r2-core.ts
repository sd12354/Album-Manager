/**
 * Pure building blocks for talking to Cloudflare R2 over its S3-compatible
 * API: config parsing, AWS Signature V4 query-string presigning, and
 * ListObjectsV2 response parsing.
 *
 * No network calls and no reads of process.env happen here, so everything is
 * unit-testable. The thin fetch wrappers live in lib/r2.ts.
 */
import { createHash, createHmac } from "node:crypto";
// Relative import (not "@/…") so this module also loads under plain vitest.
import { encodeKey, encodeKeySegment } from "./photo-storage";

export interface R2Config {
  /** S3 API host, e.g. `<account-id>.r2.cloudflarestorage.com`. */
  host: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public base URL photos are served from (r2.dev URL or custom domain). */
  publicUrl: string;
}

type Env = Record<string, string | undefined>;

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * Returns the R2 configuration when every required variable is present,
 * otherwise null. A partially filled config is treated as "not configured" so
 * the app keeps using the previous storage backend instead of half-working.
 */
export function parseR2Config(env: Env): R2Config | null {
  const accountId = clean(env.R2_ACCOUNT_ID);
  const endpoint = clean(env.R2_ENDPOINT);
  const accessKeyId = clean(env.R2_ACCESS_KEY_ID);
  const secretAccessKey = clean(env.R2_SECRET_ACCESS_KEY);
  const bucket = clean(env.R2_BUCKET);
  const publicUrl = clean(env.R2_PUBLIC_URL).replace(/\/+$/, "");

  let host = "";
  if (endpoint) {
    host = endpoint.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  } else if (accountId) {
    host = `${accountId}.r2.cloudflarestorage.com`;
  }

  if (!host || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    return null;
  }
  if (!/^https:\/\//i.test(publicUrl)) return null;

  return { host, accessKeyId, secretAccessKey, bucket, publicUrl };
}

export type S3Method = "GET" | "PUT" | "HEAD" | "DELETE";

export interface PresignInput {
  method: S3Method;
  host: string;
  /** Canonical URI: starts with `/`, each segment already RFC 3986 encoded. */
  path: string;
  region: string;
  service?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Lifetime in seconds (1 to 604800). */
  expiresIn: number;
  /** Extra query parameters to include and sign. */
  query?: Record<string, string>;
  /** Extra headers the caller must send; they are bound into the signature. */
  headers?: Record<string, string>;
  now?: Date;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function amzDate(now: Date): { date: string; dateTime: string } {
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { date: iso.slice(0, 8), dateTime: iso };
}

/**
 * AWS Signature Version 4, query-string ("presigned URL") flavour with an
 * unsigned payload. Works against S3 and S3-compatible stores such as R2.
 */
export function presignUrl(input: PresignInput): string {
  const service = input.service ?? "s3";
  const { date, dateTime } = amzDate(input.now ?? new Date());
  const scope = `${date}/${input.region}/${service}/aws4_request`;

  const headerEntries: Array<[string, string]> = [["host", input.host]];
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    headerEntries.push([
      name.toLowerCase().trim(),
      value.trim().replace(/\s+/g, " "),
    ]);
  }
  headerEntries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const signedHeaders = headerEntries.map(([name]) => name).join(";");
  const canonicalHeaders = headerEntries
    .map(([name, value]) => `${name}:${value}\n`)
    .join("");

  const queryEntries: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${input.accessKeyId}/${scope}`],
    ["X-Amz-Date", dateTime],
    ["X-Amz-Expires", String(Math.floor(input.expiresIn))],
    ["X-Amz-SignedHeaders", signedHeaders],
    ...Object.entries(input.query ?? {}),
  ];
  const canonicalQuery = queryEntries
    .map(
      ([k, v]) => [encodeKeySegment(k), encodeKeySegment(v)] as [string, string]
    )
    .sort(([a, av], [b, bv]) =>
      a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0
    )
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const canonicalRequest = [
    input.method,
    input.path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateTime,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${input.secretAccessKey}`, date);
  const kRegion = hmac(kDate, input.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  return `https://${input.host}${input.path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Browser caches and CDNs may keep photos forever: keys are never reused. */
export const PHOTO_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Canonical path for an object in the configured bucket. */
export function objectPath(config: R2Config, key: string): string {
  return `/${encodeKeySegment(config.bucket)}/${encodeKey(key)}`;
}

export interface PresignedUpload {
  url: string;
  /** Headers the uploader must send exactly as given. */
  headers: Record<string, string>;
}

/**
 * Presigned PUT for one object. The Content-Type and Cache-Control values are
 * part of the signature, so the uploader cannot swap in a different type.
 */
export function presignObjectUpload(
  config: R2Config,
  key: string,
  contentType: string,
  expiresIn = 300,
  now?: Date
): PresignedUpload {
  const headers = {
    "cache-control": PHOTO_CACHE_CONTROL,
    "content-type": contentType,
  };
  const url = presignUrl({
    method: "PUT",
    host: config.host,
    path: objectPath(config, key),
    region: "auto",
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    expiresIn,
    headers,
    now,
  });
  return { url, headers };
}

export function presignObjectRequest(
  config: R2Config,
  method: Exclude<S3Method, "PUT">,
  key: string,
  expiresIn = 60,
  now?: Date
): string {
  return presignUrl({
    method,
    host: config.host,
    path: objectPath(config, key),
    region: "auto",
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    expiresIn,
    now,
  });
}

export function presignListObjects(
  config: R2Config,
  prefix: string,
  continuationToken?: string | null,
  expiresIn = 60,
  now?: Date
): string {
  const query: Record<string, string> = {
    "list-type": "2",
    "max-keys": "1000",
    prefix,
  };
  if (continuationToken) query["continuation-token"] = continuationToken;
  return presignUrl({
    method: "GET",
    host: config.host,
    path: `/${encodeKeySegment(config.bucket)}`,
    region: "auto",
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    expiresIn,
    query,
    now,
  });
}

export interface ListedObject {
  key: string;
  size: number;
  /** MD5 hex for single-part uploads, without surrounding quotes. */
  etag: string;
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) =>
      String.fromCodePoint(parseInt(n, 16))
    )
    .replace(/&amp;/g, "&");
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decodeXml(m[1]) : null;
}

/** Strip the quotes S3 wraps around ETag values. */
export function normalizeEtag(etag: string | null | undefined): string {
  return (etag ?? "").trim().replace(/^W\//, "").replace(/^"+|"+$/g, "");
}

/** Parse a ListObjectsV2 XML response body. */
export function parseListObjectsXml(xml: string): {
  objects: ListedObject[];
  nextToken: string | null;
} {
  const objects: ListedObject[] = [];
  const blocks = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? [];
  for (const block of blocks) {
    const key = tag(block, "Key");
    if (key === null) continue;
    objects.push({
      key,
      size: Number(tag(block, "Size") ?? "0"),
      etag: normalizeEtag(tag(block, "ETag")),
    });
  }
  const truncated = (tag(xml, "IsTruncated") ?? "false") === "true";
  const nextToken = truncated ? tag(xml, "NextContinuationToken") : null;
  return { objects, nextToken };
}
