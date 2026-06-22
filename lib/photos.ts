/**
 * Photo handling utilities for VinylVault.
 *
 * Quality contract:
 *  - Files are uploaded to Supabase Storage as raw bytes (no client-side
 *    re-encoding, resizing, or compression).
 *  - The stored object's Content-Type is preserved exactly.
 *  - getOriginalPublicUrl() returns the bucket URL with NO Supabase image
 *    transformation parameters appended, so consumers (including eBay's
 *    Picture Service) download the original byte-for-byte.
 *  - When listing to eBay, the same untransformed URLs are passed in
 *    PictureDetails.PictureURL. eBay re-hosts via EPS but ingests the
 *    full-resolution master, so list-quality is preserved.
 */

export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
] as const;

export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

// HEIC/HEIF (Apple's default iPhone format) is accepted for *upload* but is
// converted to JPEG in the browser before it ever hits storage, eBay, Discogs,
// or the AI vision model — none of which can read HEIC. We list the mime types
// AND the file extensions because Safari/Chrome sometimes report an empty
// file.type for .heic files.
export const ACCEPT_ATTRIBUTE = [
  ...ACCEPTED_MIME_TYPES,
  "image/heic",
  "image/heif",
  ".heic",
  ".heif",
].join(",");

/** True when the file is an Apple HEIC/HEIF image (by mime type or extension). */
export function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

/**
 * Sniff the first 12 bytes for a valid HEIC/HEIF container. Catches files
 * that are misnamed `.heic` (e.g. someone renamed a corrupted download) or
 * have truncated headers — libheif can hang on those, so we bail
 * before it ever sees the file.
 */
async function looksLikeRealHeic(file: File): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (head.length < 12) return false;
    // Bytes 4-7 must be ASCII "ftyp".
    if (
      head[4] !== 0x66 ||
      head[5] !== 0x74 ||
      head[6] !== 0x79 ||
      head[7] !== 0x70
    ) {
      return false;
    }
    // Bytes 8-11 are the brand; accept all standard HEIC/HEIF brands.
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
    const validBrands = new Set([
      "heic", "heix", "hevc", "hevx",
      "heim", "heis", "hevm", "hevs",
      "mif1", "msf1", "avif", // avif rare but tolerated
    ]);
    return validBrands.has(brand);
  } catch {
    return false;
  }
}

/**
 * Convert a HEIC/HEIF file to a JPEG File. Decoding happens in an isolated
 * Web Worker so libheif's WASM heap never accumulates in the main thread —
 * `worker.terminate()` in the finally block guarantees every byte is
 * released, including on timeout. That's the fix for the "one bad file
 * makes the rest time out" cascade: a hung worker dies cleanly instead of
 * holding the main-thread WASM hostage.
 *
 * The pre-flight magic-byte sniff rejects malformed input before it ever
 * reaches libheif, which has no internal validation and can hang on
 * truncated or mis-extensioned files.
 */
export async function convertHeicToJpeg(
  file: File,
  totalTimeoutMs = 60_000
): Promise<File> {
  if (!isHeic(file)) return file;

  if (!(await looksLikeRealHeic(file))) {
    throw new Error("INVALID_HEIC: file is not a valid HEIC/HEIF container");
  }

  // The previous version only timed out the worker's *message wait* — if
  // file.arrayBuffer(), `new Worker(...)`, the worker's dynamic import of
  // libheif, or WASM compile ever hung, the call never returned and the
  // runner slot was stuck forever (the symptom the user kept hitting).
  // This outer Promise.race covers everything end-to-end and forcibly
  // terminates whatever worker we managed to spawn.
  // Box the worker ref so TypeScript control-flow analysis doesn't narrow
  // it to `null` across the async IIFE boundary.
  const workerRef: { current: Worker | null } = { current: null };

  const work = (async () => {
    const buffer = await file.arrayBuffer();
    const worker = new Worker(
      new URL("./heic-worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;
    const id = Math.random().toString(36).slice(2);

    const jpegBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      worker.onmessage = (
        event: MessageEvent<
          | { id: string; ok: true; buffer: ArrayBuffer }
          | { id: string; ok: false; error: string }
        >
      ) => {
        if (event.data.id !== id) return;
        if (event.data.ok) resolve(event.data.buffer);
        else reject(new Error(event.data.error));
      };
      worker.onerror = (event) => {
        reject(new Error(event.message || "HEIC worker crashed"));
      };
      worker.onmessageerror = () => {
        reject(new Error("HEIC worker sent a malformed message"));
      };
      worker.postMessage({ id, buffer }, { transfer: [buffer] });
    });

    const newName = `${file.name.replace(/\.(heic|heif)$/i, "")}.jpg`;
    return new File([jpegBuffer], newName, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  })();

  let outerTimer: ReturnType<typeof setTimeout> | undefined;
  const outerTimeout = new Promise<never>((_, reject) => {
    outerTimer = setTimeout(() => {
      reject(new Error(`HEIC conversion timed out after ${totalTimeoutMs}ms`));
    }, totalTimeoutMs);
  });

  try {
    return await Promise.race([work, outerTimeout]);
  } finally {
    if (outerTimer !== undefined) clearTimeout(outerTimer);
    // Always terminate the worker (frees the libheif WASM heap, including
    // on timeout when the worker is still mid-decode).
    if (workerRef.current) workerRef.current.terminate();
  }
}

// eBay Picture Service requirements & recommendations (sandbox + production).
export const EBAY_MIN_DIMENSION = 500; // hard minimum on longest side
export const EBAY_RECOMMENDED_DIMENSION = 1600; // recommended for zoom feature
export const EBAY_MAX_FILE_SIZE_MB = 12; // EPS rejects anything larger
export const EBAY_MAX_PHOTOS = 24; // max PictureURLs per listing

// We allow slightly larger files into storage than eBay accepts, so the
// user can keep their master copy and we can downscale only at list time
// if/when we add server-side resampling. We never resample today.
export const STORAGE_MAX_FILE_SIZE_MB = 25;

export interface PhotoValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  dimensions?: { width: number; height: number };
}

export function sanitizeFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
  const cleanBase = base
    .normalize("NFKD")
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "photo";
  return `${cleanBase}${ext}`;
}

export function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

export async function validatePhoto(file: File): Promise<PhotoValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    const friendly =
      file.type === "image/heic" || file.type === "image/heif"
        ? "This HEIC photo couldn't be converted to JPEG automatically. Try re-saving it as JPEG (Preview > Export, or your phone's share-as-JPEG option)."
        : `Unsupported file type${file.type ? ` (${file.type})` : ""}. Use JPEG, PNG, WebP, GIF, BMP, or TIFF.`;
    errors.push(friendly);
    return { ok: false, errors, warnings };
  }

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > STORAGE_MAX_FILE_SIZE_MB) {
    errors.push(
      `File is ${sizeMB.toFixed(1)}MB — must be under ${STORAGE_MAX_FILE_SIZE_MB}MB.`
    );
    return { ok: false, errors, warnings };
  }
  if (sizeMB > EBAY_MAX_FILE_SIZE_MB) {
    warnings.push(
      `File is ${sizeMB.toFixed(1)}MB. eBay rejects images over ${EBAY_MAX_FILE_SIZE_MB}MB; we'll keep your master but the listing may fail. Consider exporting at a smaller size with the same dimensions.`
    );
  }

  let dimensions: { width: number; height: number } | undefined;
  try {
    dimensions = await getImageDimensions(file);
  } catch {
    warnings.push("Couldn't read image dimensions — upload will proceed anyway.");
  }

  if (dimensions) {
    const longest = Math.max(dimensions.width, dimensions.height);
    if (longest < EBAY_MIN_DIMENSION) {
      warnings.push(
        `Image is ${dimensions.width}×${dimensions.height}px. eBay requires at least ${EBAY_MIN_DIMENSION}px on the longest side; smaller images will be rejected on listing.`
      );
    } else if (longest < EBAY_RECOMMENDED_DIMENSION) {
      warnings.push(
        `Image is ${dimensions.width}×${dimensions.height}px. eBay recommends ${EBAY_RECOMMENDED_DIMENSION}px+ to enable the zoom feature.`
      );
    }
  }

  return { ok: true, errors, warnings, dimensions };
}

/**
 * Strip any Supabase render/image transform query parameters from a public URL,
 * guaranteeing the original (untransformed) file is returned.
 */
export function getOriginalPublicUrl(url: string): string {
  try {
    const u = new URL(url);
    // Supabase serves transforms at /storage/v1/render/image/ — rewrite to
    // /storage/v1/object/ which always returns the raw bytes.
    u.pathname = u.pathname.replace(
      "/storage/v1/render/image/",
      "/storage/v1/object/"
    );
    // Drop transform query params (width, height, quality, resize, etc.).
    [
      "width",
      "height",
      "quality",
      "resize",
      "format",
      "transform",
    ].forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return url;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
