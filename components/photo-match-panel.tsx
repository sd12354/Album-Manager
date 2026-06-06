"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { ACCEPT_ATTRIBUTE } from "@/lib/photos";
import { createClient } from "@/lib/supabase/client";
import type { AlbumMatchCandidate } from "@/lib/album-matching";
import type { Album } from "@/types";
import { cn } from "@/lib/utils";

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
  error?: string;
  identified?: IdentifiedCover;
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
  const [done, setDone] = useState<{ attached: number; failed: number } | null>(
    null
  );

  const supabase = createClient();

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("albums")
        .select("id, artist, title")
        .order("title", { ascending: true });
      setAlbums((data ?? []) as Pick<Album, "id" | "artist" | "title">[]);
    })();
  }, [supabase]);

  const addFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const newRows: PhotoMatchRow[] = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
      selectedAlbumId: null,
      include: false,
    }));
    setRows((prev) => [...prev, ...newRows]);
    setDone(null);
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
    const pending = rows.filter((r) => r.status === "pending" || r.status === "error");
    if (pending.length === 0) {
      toast.message("Add cover photos first, or re-run failed rows.");
      return;
    }

    setAnalyzing(true);
    setAnalyzeProgress(0);

    for (let i = 0; i < pending.length; i++) {
      const row = pending[i];
      updateRow(row.id, { status: "analyzing", error: undefined });

      const formData = new FormData();
      formData.append("file", row.file);

      try {
        const res = await fetch("/api/albums/match-photo", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
          updateRow(row.id, {
            status: "error",
            error: data.error ?? "Analysis failed",
          });
        } else {
          const match = data.match as AlbumMatchCandidate | null;
          updateRow(row.id, {
            status: "done",
            identified: data.identified,
            match,
            alternatives: data.alternatives ?? [],
            selectedAlbumId: match?.albumId ?? null,
            include: match?.confidence === "high" || match?.confidence === "medium",
          });
        }
      } catch {
        updateRow(row.id, {
          status: "error",
          error: "Network error during analysis",
        });
      }

      setAnalyzeProgress(Math.round(((i + 1) / pending.length) * 100));
    }

    setAnalyzing(false);
    toast.success("Cover analysis complete — review matches below");
  }

  async function attachPhotos() {
    const toAttach = rows.filter((r) => r.include && r.selectedAlbumId);
    if (toAttach.length === 0) {
      toast.error("Select at least one photo with a target album.");
      return;
    }

    setAttaching(true);
    const formData = new FormData();
    const items = toAttach.map((row, index) => ({
      albumId: row.selectedAlbumId!,
      fileIndex: index,
    }));
    formData.append("items", JSON.stringify(items));
    toAttach.forEach((row, index) => {
      formData.append(`file_${index}`, row.file);
    });

    try {
      const res = await fetch("/api/albums/attach-photos", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to attach photos");
        setAttaching(false);
        return;
      }

      setDone({ attached: data.attached, failed: data.failed });
      toast.success(`Attached ${data.attached} photo${data.attached === 1 ? "" : "s"}`);
    } catch {
      toast.error("Failed to attach photos");
    }
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

  return (
    <div className="mx-auto mt-8 max-w-4xl">
      <p className="mb-6 text-sm text-muted-foreground">
        Drop front-cover photos of your vinyl. AI reads the artist and title from each
        cover (like{" "}
        <span className="text-foreground">The Hollywood Flames — Buzz Buzz Buzz</span>
        ) and matches them to albums in your catalogue. Review every match before photos
        are attached.
      </p>

      <label
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card px-6 py-10 text-center transition-colors hover:border-accent/40"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <ImageIcon className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">Drop cover photos here</p>
        <p className="mt-1 text-xs text-muted-foreground">
          JPEG, PNG, WebP — one album cover per photo
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </label>

      {rows.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              onClick={analyzePhotos}
              disabled={analyzing || rows.every((r) => r.status === "done")}
              className="gap-2"
            >
              {analyzing ? (
                <VinylSpinner size="xs" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {analyzing ? "Reading covers…" : "Analyze with AI"}
            </Button>
            {readyCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {readyCount} analyzed · {selectedCount} selected to attach
              </span>
            )}
            {unmatchedCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                {unmatchedCount} need manual album pick
              </span>
            )}
          </div>

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
                <div
                  className="h-24 w-24 shrink-0 rounded-lg border border-border bg-cover bg-center"
                  style={{ backgroundImage: `url(${row.previewUrl})` }}
                />

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

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={row.include}
                            onChange={(e) =>
                              updateRow(row.id, { include: e.target.checked })
                            }
                            className="h-3.5 w-3.5 accent-[#D4A843]"
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
            <div className="mt-6 flex justify-end">
              <Button
                onClick={attachPhotos}
                disabled={attaching || selectedCount === 0}
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
          )}
        </>
      )}

      {albums.length === 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Import your catalogue first (CSV or JSON tab) so covers can be matched to albums.
        </p>
      )}
    </div>
  );
}
