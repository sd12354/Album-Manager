import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManage, getRoleForOwner } from "@/lib/collections";
import { fetchAllPages } from "@/lib/paginate";
import { getOriginalPublicUrl } from "@/lib/photos";
import {
  contentTypeFor,
  fingerprint,
  md5Hex,
  planMigration,
  type AlbumPhotoRow,
  type SourcePhoto,
  type StoredObject,
} from "@/lib/photo-migration";
import { deleteObject, getR2Config, listAllObjects, putObject } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Stop starting new files after this long so the response beats the 60s limit. */
const TIME_BUDGET_MS = 40_000;
const MAX_FILES_PER_CALL = 40;
const CONCURRENCY = 3;

interface CopyResult {
  key: string;
  bytes: number;
  md5: string;
}

async function copyOne(
  config: NonNullable<ReturnType<typeof getR2Config>>,
  photo: SourcePhoto
): Promise<CopyResult> {
  const res = await fetch(getOriginalPublicUrl(photo.url), { cache: "no-store" });
  if (!res.ok) throw new Error(`source returned ${res.status}`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  const declared = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > 0 && declared !== bytes.length) {
    throw new Error(
      `incomplete download (${bytes.length} of ${declared} bytes)`
    );
  }
  if (bytes.length === 0) throw new Error("source file is empty");

  const md5 = md5Hex(bytes);
  const { etag } = await putObject(
    config,
    photo.key,
    bytes,
    contentTypeFor(photo.key, res.headers.get("content-type"))
  );

  // R2 reports the MD5 of what it stored. Anything else means the copy is not
  // identical to what we read, so remove it rather than leave a bad file.
  if (etag.toLowerCase() !== md5) {
    await deleteObject(config, photo.key).catch(() => undefined);
    throw new Error("checksum mismatch after upload");
  }
  return { key: photo.key, bytes: bytes.length, md5 };
}

/**
 * Copies a collection's photos from Supabase Storage to Cloudflare R2,
 * byte for byte, a batch per call. Safe to call repeatedly: files already in
 * R2 are skipped. It never edits album rows and never deletes from Supabase.
 *
 * Body: { ownerId?: string, mode?: "status" | "copy", limit?: number }
 *  - status (default): counts plus a fingerprint of the files copied so far.
 *  - copy: copy up to `limit` (max 40) pending files, then report.
 *
 * The caller must own the collection or be an editor of it.
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!config || !supabaseUrl) {
    return NextResponse.json(
      { error: "R2 storage is not configured on the server." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    ownerId?: unknown;
    mode?: unknown;
    limit?: unknown;
  };
  const ownerId =
    typeof body.ownerId === "string" && body.ownerId ? body.ownerId : user.id;
  const mode = body.mode === "copy" ? "copy" : "status";
  const limit = Math.max(
    1,
    Math.min(
      MAX_FILES_PER_CALL,
      typeof body.limit === "number" ? Math.floor(body.limit) : 20
    )
  );

  const role = await getRoleForOwner(user, ownerId);
  if (!canManage(role)) {
    return NextResponse.json(
      { error: "You need owner or editor access to this collection." },
      { status: 403 }
    );
  }

  const started = Date.now();
  let albums: AlbumPhotoRow[];
  let inR2: Map<string, StoredObject>;
  try {
    albums = await fetchAllPages<AlbumPhotoRow>((from, to) =>
      supabase
        .from("albums")
        .select("id, photo_urls")
        .eq("user_id", ownerId)
        .not("photo_urls", "is", null)
        .order("id", { ascending: true })
        .range(from, to)
    );
    const listed = await listAllObjects(config, `${ownerId}/`);
    inR2 = new Map(listed.map((o) => [o.key, { size: o.size, etag: o.etag }]));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read state" },
      { status: 502 }
    );
  }

  const plan = planMigration(albums, supabaseUrl, config.publicUrl, inR2);

  const copiedNow: CopyResult[] = [];
  const errors: Array<{ key: string; error: string }> = [];

  if (mode === "copy" && plan.pending.length > 0) {
    const queue = plan.pending.slice(0, limit);
    let next = 0;
    const worker = async () => {
      while (next < queue.length && Date.now() - started < TIME_BUDGET_MS) {
        const photo = queue[next++];
        try {
          const result = await copyOne(config, photo);
          copiedNow.push(result);
          inR2.set(result.key, { size: result.bytes, etag: result.md5 });
        } catch (err) {
          errors.push({
            key: photo.key,
            error: err instanceof Error ? err.message : "copy failed",
          });
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  // Everything this collection still links on Supabase that now exists in R2.
  const sourceKeys = [...plan.pending, ...plan.copied].map((p) => p.key);
  const present = sourceKeys
    .filter((key) => inR2.has(key))
    .map((key) => ({ key, ...inR2.get(key)! }));

  return NextResponse.json({
    ownerId,
    mode,
    supabaseLinks: sourceKeys.length,
    copiedToR2: present.length,
    remaining: sourceKeys.length - present.length,
    copiedBytes: present.reduce((sum, o) => sum + o.size, 0),
    fingerprint: fingerprint(present),
    linksAlreadyOnR2: plan.linkedToR2,
    otherLinks: plan.otherLinks,
    copiedThisCall: copiedNow.length,
    bytesThisCall: copiedNow.reduce((sum, c) => sum + c.bytes, 0),
    errors,
    elapsedMs: Date.now() - started,
  });
}
