"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ImageIcon,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { VinylSpinner } from "@/components/vinyl-spinner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCEPT_ATTRIBUTE,
  convertHeicToJpeg,
  getOriginalPublicUrl,
  isHeic,
  sanitizeFilename,
} from "@/lib/photos";
import { createClient } from "@/lib/supabase/client";
import type { AlbumMatchCandidate } from "@/lib/album-matching";
import type { Album } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Run an async worker over `items` with a fixed concurrency `limit`. Used to
 * keep HEIC conversion, AI analysis, and storage uploads bounded so a 100+
 * photo batch can't exhaust memory or open hundreds of parallel requests.
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const poolSize = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: poolSize }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) break;
      // Swallow worker failures so one bad item can't kill the runner and
      // strand the remaining queue. The worker is expected to surface its
      // own per-item errors via the UI (e.g. row.status = "error").
      try {
        await worker(items[index], index);
      } catch {
        // Already reported by the worker — keep the pool moving.
      }
    }
  });
  await Promise.all(runners);
}

/** Reject a hung conversion so the queue keeps moving. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

interface IdentifiedCover {
  artist: string;
  title: string;
  catalogNumber?: string | null;
  label?: string | null;
}

interface PhotoMatchRow {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "analyzing" | "done" | "error";
  converting?: boolean;
  error?: string;
  identified?: IdentifiedCover;
  confirmedVia?: "discogs-cover" | null;
  match?: AlbumMatchCandidate | null;
  alternatives?: AlbumMatchCandidate[];
  selectedAlbumId: string | null;
  include: boolean;
}

function confidenceBadge(confidence?: string) {
  switch (confidence) {
    case "high":
      return "bg-green-500/15 text-green-400 border-green-500/25";
    case "medium":
      return "bg-amber-500/15 text-amber-400 border-amber-500/25";
    case "low":
      return "bg-orange-500/15 text-orange-400 border-orange-500/25";
    default:
      return "bg-muted/40 text-muted-foreground border-border";
  }
}

export function PhotoMatchPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PhotoMatchRow[]>([]);
  const [albums, setAlbums] = useState<Pick<Album, "id" | "artist" | "title">[]>(
    []
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [attaching, setAttaching] = useState(false);
  const [attachProgress, setAttachProgress] = useState(0);
  const [converting, setConverting] = useState(false);
  const [convertDone, setConvertDone] = useState(0);
  const [convertTotal, setConvertTotal] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [done, setDone] = useState<{ attached: number; failed: number } | null>(
    null
  );
  const [ownerId, setOwnerId] = useState<string>("");
  const [canEdit, setCanEdit] = useState(true);
  const [collectionLabel, setCollectionLabel] = useState<string | null>(null);
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    void (async () => {
      setCollectionLoading(true);
      setCollectionError(null);
      try {
        const res = await fetch("/api/collection/active");
        if (!res.ok) {
          throw new Error("Could not load your active collection.");
        }
        const { active } = await res.json();
        if (!active?.ownerId) {
          throw new Error("No active collection is available.");
        }

        const activeOwner = active.ownerId as string;
        setOwnerId(activeOwner);
        setCanEdit(active.role === "owner" || active.role === "editor");
        setCollectionLabel(active.isOwner ? null : (active.label as string));

        const { data, error } = await supabase
          .from("albums")
          .select("id, artist, title")
          .eq("user_id", activeOwner)
          .order("title", { ascending: true });
        if (error) throw error;
        setAlbums((data ?? []) as Pick<Album, "id" | "artist" | "title">[]);
      } catch (error) {
        setAlbums([]);
        setCanEdit(false);
        setCollectionError(
          error instanceof Error
            ? error.message
            : "Could not load your active collection."
        );
      } finally {
        setCollectionLoading(false);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl]);

  // Free every blob URL when the panel unmounts so navigating away from a
  // 100-photo session doesn't strand the browser holding ~100 Object URLs.
  useEffect(() => {
    return () => {
      setRows((prev) => {
        for (const row of prev) {
          if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
        }
        return prev;
      });
    };
  }, []);

  const addFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;

    // Create rows immediately so the UI stays responsive even with 100+ files.
    // iPhone HEIC/HEIF photos can't be previewed by the browser or read by the
    // AI model, so those start in a "converting" state and get their JPEG
    // preview filled in once conversion finishes.
    const initialRows: PhotoMatchRow[] = files.map((file) => {
      const heic = isHeic(file);
      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: heic ? "" : URL.createObjectURL(file),
        status: "pending" as const,
        converting: heic,
        selectedAlbumId: null,
        include: false,
      };
    });

    setRows((prev) => [...prev, ...initialRows]);
    setDone(null);

    const heicRows = initialRows.filter((r) => r.converting);
    if (heicRows.length === 0) return;

    // Decoding HEIC/HEIF is CPU- and memory-heavy (canvas + WASM). Converting
    // hundreds at once would crash the tab, so we use a small worker pool that
    // keeps peak memory flat while still being fast.
    setConverting(true);
    setConvertTotal(heicRows.length);
    setConvertDone(0);
    let completed = 0;

    // Each conversion runs in its own Web Worker that is terminated
    // immediately after — there's no shared WASM heap in the main thread to
    // corrupt, so a hung or malformed file can't bleed into the next one.
    // Concurrency can be modest again now that memory is bounded.
    const concurrency = heicRows.length > 50 ? 2 : heicRows.length > 10 ? 3 : 4;

    try {
      await runWithConcurrency(heicRows, concurrency, async (row) => {
        try {
          // Built-in timeout inside convertHeicToJpeg will terminate() the
          // worker on timeout, freeing the libheif heap cleanly.
          const jpeg = await convertHeicToJpeg(row.file);
          // Revoke any stale preview URL we created earlier so 100-photo
          // batches don't leak ~100MB of unreleased Object URLs.
          if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
          updateRow(row.id, {
            file: jpeg,
            previewUrl: URL.createObjectURL(jpeg),
            converting: false,
          });
        } catch (err) {
          let message: string;
          if (err instanceof Error && err.message.startsWith("INVALID_HEIC")) {
            message = "Not a valid HEIC file. Re-export from your Photos app and try again.";
          } else if (err instanceof Error && err.message.includes("timed out")) {
            message = "Conversion timed out — try re-exporting this photo as JPEG.";
          } else {
            message =
              err instanceof Error && err.message
                ? `Couldn't convert: ${err.message}`
                : "Couldn't convert this HEIC/HEIF photo to JPEG.";
          }
          updateRow(row.id, {
            status: "error",
            error: message,
            converting: false,
          });
        } finally {
          completed += 1;
          setConvertDone(completed);
        }
      });
    } finally {
      // Always clear the global converting flag, even if the pool itself
      // explodes for some reason — and force any row that's still flagged
      // as converting into an error state so the UI never gets stuck.
      setRows((prev) =>
        prev.map((r) =>
          r.converting
            ? {
                ...r,
                converting: false,
                status: "error",
                error: r.error ?? "Conversion failed unexpectedly.",
              }
            : r
        )
      );
      setConverting(false);
    }
  }, []);

  function removeRow(id: string) {
    setRows((prev) => {
      const row = prev.find((r) => r.id === id);
      if (row) URL.revokeObjectURL(row.previewUrl);
      return prev.filter((r) => r.id !== id);
    });
  }

  function updateRow(id: string, patch: Partial<PhotoMatchRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function analyzePhotos() {
    if (converting) {
      toast.message("Still converting HEIC/HEIF photos — hang on a moment.");
      return;
    }
    const pending = rows.filter(
      (r) => (r.status === "pending" || r.status === "error") && !r.converting
    );
    if (pending.length === 0) {
      toast.message("Add cover photos first, or re-run failed rows.");
      return;
    }

    setAnalyzing(true);
    setAnalyzeProgress(0);
    let completed = 0;
    let rateLimitedToastShown = false;

    // Each photo triggers up to 3 Anthropic Vision calls server-side
    // (OCR + visual compare across Discogs candidates). 4 concurrent → 12
    // in-flight which blows past most rate limits on 100+ batches. Scale
    // down for big batches.
    const analyzeConcurrency =
      pending.length > 50 ? 2 : pending.length > 20 ? 3 : 4;

    await runWithConcurrency(pending, analyzeConcurrency, async (row) => {
      updateRow(row.id, { status: "analyzing", error: undefined });

      // Up to 3 attempts with exponential backoff so transient 429s and
      // 5xxs don't dump a whole row into an error state. Real failures
      // (4xx other than 429, fatal network errors) abort early.
      const MAX_ATTEMPTS = 3;
      let lastError = "Analysis failed";

      try {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          // Rebuild FormData each attempt — File is fine to re-read.
          const formData = new FormData();
          formData.append("file", row.file);

          let res: Response;
          try {
            res = await withTimeout(
              fetch("/api/albums/match-photo", {
                method: "POST",
                body: formData,
              }),
              60_000,
              `Analyzing ${row.file.name}`
            );
          } catch (err) {
            lastError =
              err instanceof Error && err.message.includes("timed out")
                ? "Analysis timed out"
                : "Network error during analysis";
            if (attempt < MAX_ATTEMPTS) {
              await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
              continue;
            }
            break;
          }

          // Retry on 429 (rate limit) and 5xx; bail on other 4xxs.
          if (res.status === 429 || res.status >= 500) {
            if (res.status === 429 && !rateLimitedToastShown) {
              rateLimitedToastShown = true;
              toast.warning(
                "Hit the AI rate limit — slowing down and retrying.",
                { duration: 5000 }
              );
            }
            lastError =
              res.status === 429 ? "Rate limited — retrying" : `Server ${res.status}`;
            if (attempt < MAX_ATTEMPTS) {
              const backoff = 1000 * 2 ** (attempt - 1);
              await new Promise((r) => setTimeout(r, backoff));
              continue;
            }
            updateRow(row.id, {
              status: "error",
              error: res.status === 429
                ? "AI rate limit — try again in a minute."
                : lastError,
            });
            return;
          }

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            updateRow(row.id, {
              status: "error",
              error: data.error ?? "Analysis failed",
            });
            return;
          }

          const match = data.match as AlbumMatchCandidate | null;
          updateRow(row.id, {
            status: "done",
            identified: data.identified,
            confirmedVia: data.confirmedVia ?? null,
            match,
            alternatives: data.alternatives ?? [],
            selectedAlbumId: match?.albumId ?? null,
            include: match?.confidence === "high" || match?.confidence === "medium",
          });
          return;
        }

        // All attempts exhausted — surface whatever the last error was.
        updateRow(row.id, { status: "error", error: lastError });
      } finally {
        completed += 1;
        setAnalyzeProgress(Math.round((completed / pending.length) * 100));
      }
    });

    setAnalyzing(false);
    const errs = rows.filter((r) => r.status === "error").length;
    if (errs > 0) {
      toast.warning(
        `Analysis done — ${errs} photo${errs === 1 ? "" : "s"} had errors, review below.`,
        { duration: 6000 }
      );
    } else {
      toast.success("Cover analysis complete — review matches below");
    }
  }

  async function attachPhotos() {
    const toAttach = rows.filter(
      (r) => r.include && r.selectedAlbumId && !r.converting
    );
    if (toAttach.length === 0) {
      toast.error("Select at least one photo with a target album.");
      return;
    }

    setAttaching(true);
    setAttachProgress(0);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Your session expired — please sign in again.");
      setAttaching(false);
      return;
    }

    // Upload binaries straight to Supabase Storage from the browser, with
    // bounded concurrency. This bypasses the serverless request-body limit
    // entirely, so 100+ full-resolution photos upload reliably instead of
    // being crammed into one giant multipart request.
    const uploaded: Array<{ albumId: string; url: string }> = [];
    let failed = 0;
    let completed = 0;

    // Same scaling story as the analyze step — 4 parallel multi-MB uploads
    // on a flaky connection saturate the link and trigger timeouts.
    const attachConcurrency =
      toAttach.length > 50 ? 2 : toAttach.length > 20 ? 3 : 4;

    await runWithConcurrency(toAttach, attachConcurrency, async (row) => {
      try {
        const safeName = sanitizeFilename(row.file.name || "cover.jpg");
        const rand = Math.random().toString(36).slice(2, 8);
        // Upload under the active collection owner's folder (storage RLS keys
        // on the owner id), falling back to the current user for own albums.
        const folderOwner = ownerId || user.id;
        const path = `${folderOwner}/${row.selectedAlbumId}/${Date.now()}-${rand}-${safeName}`;

        const { error: uploadError } = await withTimeout(
          supabase.storage
            .from("album-photos")
            .upload(path, row.file, {
              contentType: row.file.type || "image/jpeg",
              upsert: false,
              cacheControl: "31536000",
            }),
          60_000,
          `Uploading ${row.file.name}`
        );

        if (uploadError) {
          failed += 1;
          updateRow(row.id, {
            status: "error",
            error: `Upload failed: ${uploadError.message}`,
          });
          return;
        }

        const { data: urlData } = supabase.storage
          .from("album-photos")
          .getPublicUrl(path);

        uploaded.push({
          albumId: row.selectedAlbumId!,
          url: getOriginalPublicUrl(urlData.publicUrl),
        });
      } catch (err) {
        failed += 1;
        const message =
          err instanceof Error && err.message.includes("timed out")
            ? "Upload timed out — check your connection."
            : err instanceof Error
              ? `Upload failed: ${err.message}`
              : "Upload failed";
        updateRow(row.id, { status: "error", error: message });
      } finally {
        completed += 1;
        setAttachProgress(Math.round((completed / toAttach.length) * 100));
      }
    });

    // Persist all new URLs to their albums in one tiny JSON request.
    let attached = 0;
    if (uploaded.length > 0) {
      try {
        const res = await fetch("/api/albums/attach-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: uploaded }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error ?? "Photos uploaded but couldn't be saved.");
          setAttaching(false);
          return;
        }
        attached = data.attached ?? uploaded.length;
        failed += data.skipped ?? 0;
      } catch {
        toast.error("Photos uploaded but couldn't be saved to albums.");
        setAttaching(false);
        return;
      }
    }

    setDone({ attached, failed });
    toast.success(`Attached ${attached} photo${attached === 1 ? "" : "s"}`);
    setAttaching(false);
  }

  const readyCount = rows.filter((r) => r.status === "done").length;
  const selectedCount = rows.filter((r) => r.include && r.selectedAlbumId).length;
  const unmatchedCount = rows.filter(
    (r) => r.status === "done" && !r.match && !r.selectedAlbumId
  ).length;

  if (done) {
    return (
      <div className="mx-auto max-w-2xl text-center animate-fade-in-up">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-400" />
        <p className="mt-4 font-display text-2xl font-bold">
          Attached {done.attached} cover photo{done.attached === 1 ? "" : "s"}
        </p>
        {done.failed > 0 && (
          <p className="mt-2 text-sm text-amber-400">
            {done.failed} photo{done.failed === 1 ? "" : "s"} could not be attached
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href="/albums">View Catalogue</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              rows.forEach((r) => URL.revokeObjectURL(r.previewUrl));
              setRows([]);
              setDone(null);
            }}
          >
            Match More Photos
          </Button>
        </div>
      </div>
    );
  }

  if (collectionLoading) {
    return (
      <div className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-sm text-muted-foreground">
        <VinylSpinner size="sm" />
        Loading active collection...
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 max-w-4xl">
      <p className="mb-6 text-sm text-muted-foreground">
        Drop front-cover photos of your vinyl. AI reads the artist and title from each
        cover (like{" "}
        <span className="text-foreground">The Hollywood Flames — Buzz Buzz Buzz</span>
        ) and matches them to albums in your catalogue. Review every match before photos
        are attached.
      </p>

      {collectionLabel && (
        <p className="mb-4 rounded-lg border border-border bg-secondary/30 px-4 py-2 text-xs text-muted-foreground">
          Matching photos into the shared collection{" "}
          <span className="font-medium text-foreground">{collectionLabel}</span>.
        </p>
      )}

      {collectionError && (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {collectionError} Refresh the page or choose a collection before
          matching photos.
        </div>
      )}

      {collectionError ? null : !canEdit ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          You have view-only access to this collection, so cover photos can&apos;t
          be attached here.
        </div>
      ) : (
      <label
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card px-6 py-10 text-center transition-colors hover:border-accent/40"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void addFiles(e.dataTransfer.files);
        }}
      >
        <ImageIcon className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">Drop cover photos here</p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPEG, PNG, WebP, HEIC, HEIF — one album cover per photo. iPhone
          HEIC/HEIF photos convert automatically. Hundreds at a time is fine.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          className="hidden"
          onChange={(e) => void addFiles(e.target.files)}
        />
      </label>
      )}

      {rows.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              onClick={analyzePhotos}
              disabled={
                analyzing ||
                converting ||
                rows.every((r) => r.status === "done")
              }
              className="gap-2"
            >
              {analyzing || converting ? (
                <VinylSpinner size="xs" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {converting
                ? "Converting…"
                : analyzing
                  ? "Reading covers…"
                  : "Analyze with AI"}
            </Button>
            {converting && (
              <span className="text-xs text-muted-foreground">
                Converting HEIC/HEIF {convertDone}/{convertTotal}
              </span>
            )}
            {!converting && readyCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {readyCount} analyzed · {selectedCount} selected to attach
              </span>
            )}
            {!converting && unmatchedCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {unmatchedCount} need manual album pick
              </span>
            )}
          </div>

          {converting && (
            <Progress
              value={
                convertTotal > 0
                  ? Math.round((convertDone / convertTotal) * 100)
                  : 0
              }
              className="mt-3"
            />
          )}
          {analyzing && <Progress value={analyzeProgress} className="mt-3" />}

          <div className="mt-6 space-y-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "flex gap-4 rounded-xl border p-4",
                  row.status === "error"
                    ? "border-red-500/25 bg-red-500/5"
                    : "border-border bg-card"
                )}
              >
                {row.converting || !row.previewUrl ? (
                  <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-secondary/30">
                    <VinylSpinner size="xs" />
                    <span className="text-[9px] text-muted-foreground">
                      {row.converting ? "Converting" : ""}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(row.previewUrl)}
                    title="Click to expand"
                    className="group relative h-24 w-24 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-border bg-cover bg-center transition-transform hover:scale-[1.03]"
                    style={{ backgroundImage: `url(${row.previewUrl})` }}
                  >
                    <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                  </button>
                )}

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium">{row.file.name}</p>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="text-muted-foreground hover:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {row.status === "pending" && (
                    <p className="text-xs text-muted-foreground">Waiting for analysis</p>
                  )}
                  {row.status === "analyzing" && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <VinylSpinner size="xs" /> Reading cover text…
                    </p>
                  )}
                  {row.status === "error" && (
                    <p className="text-xs text-red-400">{row.error}</p>
                  )}
                  {row.status === "done" && row.identified && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Detected:{" "}
                        <span className="text-foreground">
                          {row.identified.artist} — {row.identified.title}
                        </span>
                        {row.identified.catalogNumber && (
                          <> · Cat# {row.identified.catalogNumber}</>
                        )}
                      </p>

                      {row.confirmedVia === "discogs-cover" && (
                        <p className="flex items-center gap-1 text-[11px] text-accent">
                          <CheckCircle2 className="h-3 w-3" />
                          Confirmed by matching the cover art to Discogs
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={row.include}
                            onChange={(e) =>
                              updateRow(row.id, { include: e.target.checked })
                            }
                            className="h-3.5 w-3.5 accent-[#8b7fe8]"
                          />
                          Attach to
                        </label>

                        <Select
                          value={row.selectedAlbumId ?? ""}
                          onValueChange={(albumId) =>
                            updateRow(row.id, {
                              selectedAlbumId: albumId,
                              include: true,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 max-w-xs text-xs">
                            <SelectValue placeholder="Pick album…" />
                          </SelectTrigger>
                          <SelectContent>
                            {(row.alternatives ?? []).map((alt) => (
                              <SelectItem key={alt.albumId} value={alt.albumId}>
                                {alt.artist} — {alt.title}
                                {alt.confidence !== "none" && (
                                  <> ({Math.round(alt.score * 100)}%)</>
                                )}
                              </SelectItem>
                            ))}
                            {albums
                              .filter(
                                (a) =>
                                  !(row.alternatives ?? []).some(
                                    (alt) => alt.albumId === a.id
                                  )
                              )
                              .map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.artist} — {a.title}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>

                        {row.match && (
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                              confidenceBadge(row.match.confidence)
                            )}
                          >
                            {row.match.confidence} match
                          </span>
                        )}
                        {!row.match && (
                          <span className="text-[10px] text-amber-400">
                            No auto-match — pick manually
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {readyCount > 0 && (
            <div className="mt-6 space-y-2">
              {attaching && (
                <div className="flex items-center gap-3">
                  <Progress value={attachProgress} className="flex-1" />
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Uploading {attachProgress}%
                  </span>
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  onClick={attachPhotos}
                  disabled={attaching || converting || selectedCount === 0}
                  className="gap-2"
                >
                  {attaching ? (
                    <VinylSpinner size="xs" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Attach {selectedCount} Photo{selectedCount === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {albums.length === 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Import your catalogue first (CSV or JSON tab) so covers can be matched to albums.
        </p>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Cover photo"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
