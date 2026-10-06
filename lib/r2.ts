import "server-only";
import {
  PHOTO_CACHE_CONTROL,
  normalizeEtag,
  parseListObjectsXml,
  parseR2Config,
  presignListObjects,
  presignObjectRequest,
  presignObjectUpload,
  type ListedObject,
  type R2Config,
} from "@/lib/r2-core";

export type { ListedObject, R2Config } from "@/lib/r2-core";
export { presignObjectUpload } from "@/lib/r2-core";

/**
 * Cloudflare R2 configuration from the environment, or null when R2 is not
 * (fully) configured. Callers fall back to Supabase Storage on null.
 */
export function getR2Config(): R2Config | null {
  return parseR2Config(process.env);
}

async function describeFailure(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  const code = text.match(/<Code>([^<]+)<\/Code>/)?.[1];
  return `${res.status}${code ? ` ${code}` : ""}`;
}

/** Upload bytes from the server. Returns the ETag R2 computed (MD5 hex). */
export async function putObject(
  config: R2Config,
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<{ etag: string }> {
  const { url, headers } = presignObjectUpload(config, key, contentType, 120);
  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: body as BodyInit,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`R2 upload failed (${await describeFailure(res)})`);
  }
  return { etag: normalizeEtag(res.headers.get("etag")) };
}

/** Metadata for one object, or null when it does not exist. */
export async function headObject(
  config: R2Config,
  key: string
): Promise<{ size: number; etag: string; contentType: string | null } | null> {
  const res = await fetch(presignObjectRequest(config, "HEAD", key), {
    method: "HEAD",
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 lookup failed (${res.status})`);
  return {
    size: Number(res.headers.get("content-length") ?? "0"),
    etag: normalizeEtag(res.headers.get("etag")),
    contentType: res.headers.get("content-type"),
  };
}

export async function deleteObject(config: R2Config, key: string): Promise<void> {
  const res = await fetch(presignObjectRequest(config, "DELETE", key), {
    method: "DELETE",
    cache: "no-store",
  });
  // S3 semantics: deleting a missing key is a success (204).
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed (${await describeFailure(res)})`);
  }
}

/** Every object under a prefix (follows pagination). */
export async function listAllObjects(
  config: R2Config,
  prefix: string
): Promise<ListedObject[]> {
  const all: ListedObject[] = [];
  let token: string | null = null;
  // Hard stop so a paging bug can never spin forever (50k objects).
  for (let page = 0; page < 50; page++) {
    const res: Response = await fetch(presignListObjects(config, prefix, token), {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`R2 list failed (${await describeFailure(res)})`);
    }
    const parsed = parseListObjectsXml(await res.text());
    all.push(...parsed.objects);
    token = parsed.nextToken;
    if (!token) break;
  }
  return all;
}

export { PHOTO_CACHE_CONTROL };
