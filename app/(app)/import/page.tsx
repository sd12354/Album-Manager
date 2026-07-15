"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileJson,
  ImageIcon,
  Upload,
  X,
} from "lucide-react";
import { PhotoMatchPanel } from "@/components/photo-match-panel";
import { toast } from "sonner";
import { CSVDropzone } from "@/components/csv-dropzone";
import { VinylSpinner } from "@/components/vinyl-spinner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deriveRows,
  parseAlbumCSV,
  TARGET_FIELDS,
  type TargetField,
} from "@/lib/csv";

const STEPS = ["Upload", "Preview", "Import"];
const REQUIRED_TARGETS: TargetField[] = ["title", "artist", "condition"];

type Mode = "csv" | "json" | "photos";

interface BoxFile {
  name: string;
  records: unknown[];
  error?: string;
}

export default function ImportPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("csv");

  // ── CSV state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [detectionDetail, setDetectionDetail] = useState<
    Record<string, { target: string; via: "alias" | "fuzzy" | "content" | "none" }>
  >({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [headerless, setHeaderless] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [showAllErrors, setShowAllErrors] = useState(false);

  // ── JSON state ─────────────────────────────────────────────────────────────
  const [boxFiles, setBoxFiles] = useState<BoxFile[]>([]);
  const [jsonImporting, setJsonImporting] = useState(false);
  const [jsonProgress, setJsonProgress] = useState(0);
  const [jsonResult, setJsonResult] = useState<{ count: number; skipped: number } | null>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [canEditCollection, setCanEditCollection] = useState<boolean | null>(null);

  const resetImportState = useCallback(() => {
    setMode("csv");
    setStep(0);
    setFile(null);
    setRawRows([]);
    setHeaders([]);
    setColumnMapping({});
    setDetectionDetail({});
    setParseError(null);
    setHeaderless(false);
    setImporting(false);
    setProgress(0);
    setImportedCount(0);
    setImportError(null);
    setShowAllErrors(false);
    setBoxFiles([]);
    setJsonImporting(false);
    setJsonProgress(0);
    setJsonResult(null);
  }, []);

  // ── CSV derived ────────────────────────────────────────────────────────────
  const { rows, errors, invalidCount } = useMemo(
    () =>
      deriveRows(rawRows, columnMapping, {
        firstDataRowNumber: headerless ? 1 : 2,
      }),
    [rawRows, columnMapping, headerless]
  );
  const mappedTargets = useMemo(
    () => new Set(Object.values(columnMapping).filter((v) => v !== "skip")),
    [columnMapping]
  );
  const missingRequired = REQUIRED_TARGETS.filter((t) => !mappedTargets.has(t));

  useEffect(() => {
    let cancelled = false;
    async function loadActiveCollection() {
      setCanEditCollection(null);
      try {
        const res = await fetch("/api/collection/active");
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setCanEditCollection(res.ok && data.active?.role !== "viewer");
        }
      } catch {
        if (!cancelled) setCanEditCollection(false);
      }
    }

    void loadActiveCollection();
    const onCollectionChanged = () => {
      resetImportState();
      void loadActiveCollection();
    };
    window.addEventListener("vinylvault:collection-changed", onCollectionChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("vinylvault:collection-changed", onCollectionChanged);
    };
  }, [resetImportState]);

  // ── CSV handlers ───────────────────────────────────────────────────────────
  async function handleFileSelect(selectedFile: File) {
    setFile(selectedFile);
    setParseError(null);
    setImportError(null);
    setShowAllErrors(false);
    const result = await parseAlbumCSV(selectedFile);
    setHeaders(result.headers);
    setRawRows(result.rawRows);
    setColumnMapping(result.detectedMapping);
    setDetectionDetail(result.detectionDetail);
    setHeaderless(result.headerless);
    if (result.errors.length > 0 && result.rawRows.length === 0) {
      setParseError(result.errors[0]);
    }
  }

  async function reparseAs(hasHeaderRow: boolean) {
    if (!file) return;
    setShowAllErrors(false);
    const result = await parseAlbumCSV(file, { hasHeaderRow });
    setHeaders(result.headers);
    setRawRows(result.rawRows);
    setDetectionDetail(result.detectionDetail);
    setColumnMapping(result.detectedMapping);
    setHeaderless(result.headerless);
  }

  function handleContinue() {
    if (step === 0 && file && rawRows.length > 0) setStep(1);
    else if (step === 1 && rows.length > 0) {
      setImportedCount(0);
      setImportError(null);
      setStep(2);
      handleImport();
    }
  }

  async function handleImport() {
    setImporting(true);
    setImportError(null);
    setProgress(10);
    try {
      const res = await fetch("/api/albums/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albums: rows }),
      });
      setProgress(80);
      if (!res.ok) {
        const data = await res.json();
        const message = data.error ?? "Import failed";
        setImportError(message);
        toast.error(message);
        setImporting(false);
        return;
      }
      const data = await res.json();
      setImportedCount(data.count);
      setProgress(100);
      toast.success(`Imported ${data.count} albums`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      setImportError(message);
      toast.error(message);
    }
    setImporting(false);
  }

  // ── JSON handlers ──────────────────────────────────────────────────────────
  async function handleJsonFiles(fileList: FileList | null) {
    if (!fileList) return;
    const parsed: BoxFile[] = [...boxFiles];

    for (const f of Array.from(fileList)) {
      if (parsed.find((b) => b.name === f.name)) continue; // dedupe
      try {
        const text = await f.text();
        const records = JSON.parse(text);
        if (!Array.isArray(records)) throw new Error("Expected a JSON array");
        parsed.push({ name: f.name, records });
      } catch (err) {
        parsed.push({
          name: f.name,
          records: [],
          error: err instanceof Error ? err.message : "Parse error",
        });
      }
    }

    setBoxFiles(parsed);
    setJsonResult(null);
  }

  function removeBoxFile(name: string) {
    setBoxFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function handleJsonImport() {
    const validFiles = boxFiles.filter((f) => !f.error && f.records.length > 0);
    if (validFiles.length === 0) return;

    setJsonImporting(true);
    setJsonProgress(20);

    try {
      const res = await fetch("/api/albums/import-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: validFiles.map((f) => ({ name: f.name, records: f.records })),
        }),
      });
      setJsonProgress(85);

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Import failed");
        setJsonImporting(false);
        return;
      }

      const data = await res.json();
      setJsonResult({ count: data.count, skipped: data.skipped });
      setJsonProgress(100);
      toast.success(
        `Imported ${data.count} albums${data.skipped ? ` (${data.skipped} skipped)` : ""}`
      );
      if (data.pricingCacheFailed) {
        toast.warning(
          `${data.pricingCacheFailed} imported price record${data.pricingCacheFailed === 1 ? "" : "s"} could not be preloaded. Refresh pricing from the catalogue if needed.`,
          { duration: 8000 }
        );
      }
    } catch {
      toast.error("Import failed");
    }
    setJsonImporting(false);
  }

  const totalJsonRecords = boxFiles.reduce(
    (s, f) => s + (f.error ? 0 : f.records.length),
    0
  );
  const visibleErrors = showAllErrors ? errors : errors.slice(0, 5);
  const allRowsFailed = rawRows.length > 0 && rows.length === 0;

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-3xl font-bold">Import</h1>

      {canEditCollection === false && (
        <div className="mt-6 max-w-2xl rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="font-medium text-foreground">View-only collection</p>
              <p className="mt-1 text-muted-foreground">
                You can browse this collection, but only the owner or an editor can import albums or attach cover photos.
              </p>
            </div>
          </div>
        </div>
      )}

      {canEditCollection === null && (
        <div className="flex justify-center py-8">
          <VinylSpinner label="Checking collection access..." />
        </div>
      )}

      {/* Mode tabs */}
      {canEditCollection && <div className="mt-6 flex gap-1 rounded-xl border border-border bg-card p-1 w-fit">
        <button
          onClick={() => setMode("csv")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "csv"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          CSV File
        </button>
        <button
          onClick={() => setMode("json")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "json"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileJson className="h-4 w-4" />
          Box JSON Files
        </button>
        <button
          onClick={() => setMode("photos")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "photos"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          Cover Photos
        </button>
      </div>}

      {/* ── CSV mode ────────────────────────────────────────────────────────── */}
      {canEditCollection && mode === "csv" && (
        <>
          <div className="mx-auto mt-8 flex max-w-md items-center justify-center">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${
                      i <= step ? "bg-accent text-accent-foreground scale-110" : "bg-input text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className="mt-1 text-xs text-muted-foreground">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mx-4 h-0.5 w-16 transition-colors duration-500 ${i < step ? "bg-accent" : "bg-input"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            {step === 0 && (
              <>
                <CSVDropzone onFileSelect={handleFileSelect} selectedFile={file} />
                {parseError && <p className="mt-4 text-sm text-red-400">{parseError}</p>}
                {file && rawRows.length > 0 && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Detected {rawRows.length} rows and {headers.length} columns.
                  </p>
                )}
                {file && rawRows.length > 0 && (
                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleContinue}>Continue</Button>
                  </div>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <div className="mb-6 rounded-xl border border-border bg-card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-display text-base font-semibold">Column mapping</p>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={headerless}
                        onChange={(e) => reparseAs(!e.target.checked)}
                        className="h-3.5 w-3.5 cursor-pointer accent-[#8b7fe8]"
                      />
                      First row is data, not headers
                    </label>
                  </div>
                  {headerless && (
                    <p className="mb-3 text-xs text-muted-foreground">
                      No header row detected — columns guessed by position. Adjust below if needed.
                    </p>
                  )}
                  {missingRequired.length > 0 && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Missing required:{" "}
                        {missingRequired.map((t) => TARGET_FIELDS.find((f) => f.key === t)?.label).join(", ")}
                      </span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {headers.map((h) => {
                      const sample = rawRows[0]?.[h] ?? "";
                      const value = columnMapping[h] ?? "skip";
                      const isDuplicate =
                        value !== "skip" &&
                        Object.entries(columnMapping).filter(([k, v]) => v === value && k !== h).length > 0;
                      return (
                        <div key={h} className="grid grid-cols-[1fr_auto_220px] items-center gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">{h}</p>
                              {detectionDetail[h]?.via === "fuzzy" && value !== "skip" && (
                                <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-400" title="Header matched by fuzzy similarity — please confirm">
                                  guessed
                                </span>
                              )}
                              {detectionDetail[h]?.via === "content" && value !== "skip" && (
                                <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-400" title="Mapping inferred from column values — please confirm">
                                  inferred
                                </span>
                              )}
                            </div>
                            {sample && <p className="truncate text-xs text-muted-foreground">e.g. {sample}</p>}
                          </div>
                          <span className="text-xs text-muted-foreground">→</span>
                          <Select value={value} onValueChange={(v) => setColumnMapping((prev) => ({ ...prev, [h]: v }))}>
                            <SelectTrigger className={isDuplicate ? "border-amber-500/40" : value === "skip" ? "border-border text-muted-foreground" : "border-accent/40"}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TARGET_FIELDS.map((f) => (
                                <SelectItem key={f.key} value={f.key}>
                                  {f.label}{f.required ? " *" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-sm">
                    <span className="font-medium text-foreground">{rows.length}</span> of {rawRows.length} rows ready
                  </span>
                  {invalidCount > 0 && <span className="ml-auto text-xs text-amber-400">{invalidCount} skipped</span>}
                </div>

                {errors.length > 0 && (
                  <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                    <p className="text-sm font-medium text-red-400">{errors.length} validation error{errors.length > 1 ? "s" : ""}</p>
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-2">
                      {visibleErrors.map((err, i) => <li key={i} className="text-xs text-red-400">{err}</li>)}
                    </ul>
                    {errors.length > 5 && (
                      <button onClick={() => setShowAllErrors((v) => !v)} className="mt-2 text-xs text-accent hover:underline">
                        {showAllErrors ? "Show less" : `Show all ${errors.length} errors`}
                      </button>
                    )}
                    {allRowsFailed && (
                      <p className="mt-3 border-t border-red-500/20 pt-3 text-xs text-red-300">
                        All rows failed. Check column mapping and Condition values.
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Artist</TableHead>
                        <TableHead>Genre</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Catalog #</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            No valid rows yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.slice(0, 10).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell>{row.title}</TableCell>
                            <TableCell>{row.artist}</TableCell>
                            <TableCell>{row.genre ?? "—"}</TableCell>
                            <TableCell>{row.condition}</TableCell>
                            <TableCell>{row.catalog_number ?? "—"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {rows.length > 0 && <p className="mt-2 text-sm text-muted-foreground">Showing {Math.min(rows.length, 10)} of {rows.length} valid rows</p>}

                <div className="mt-6 flex justify-between">
                  <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                  <Button onClick={handleContinue} disabled={rows.length === 0}>Import {rows.length} Album{rows.length === 1 ? "" : "s"}</Button>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="text-center animate-fade-in">
                {importing ? (
                  <>
                    <div className="flex justify-center"><VinylSpinner size="xl" /></div>
                    <p className="mt-6 text-lg font-medium">Importing albums...</p>
                    <Progress value={progress} className="mt-4" />
                  </>
                ) : importError ? (
                  <div className="animate-fade-in-up">
                    <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
                    <p className="mt-4 font-display text-2xl font-bold">Import failed</p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{importError}</p>
                    <div className="mt-6 flex justify-center gap-3">
                      <Button onClick={handleImport}>Try Again</Button>
                      <Button variant="outline" onClick={() => setStep(1)}>Back to Preview</Button>
                    </div>
                  </div>
                ) : (
                  <div className="animate-fade-in-up">
                    <p className="font-display text-2xl font-bold">Successfully imported {importedCount} albums</p>
                    <div className="mt-6 flex justify-center gap-3">
                      <Button asChild><Link href="/albums">Go to Catalogue</Link></Button>
                      <Button variant="outline" onClick={() => router.push("/albums?action=price-all")}>Price All Now</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Cover photo matching ──────────────────────────────────────────── */}
      {canEditCollection && mode === "photos" && <PhotoMatchPanel />}

      {/* ── JSON / Box Files mode ─────────────────────────────────────────── */}
      {canEditCollection && mode === "json" && (
        <div className="mx-auto mt-8 max-w-3xl">
          {!jsonResult ? (
            <>
              <p className="text-sm text-muted-foreground mb-6">
                Drop your <strong className="text-foreground">BOX_*_priced.json</strong> files here. Each file is
                imported as-is — pricing, condition, and notes are mapped automatically. Multiple files can be
                imported in one shot.
              </p>

              {/* Drop zone */}
              <label
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card px-6 py-10 text-center transition-colors hover:border-accent/40"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleJsonFiles(e.dataTransfer.files); }}
              >
                <FileJson className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Drop JSON box files here</p>
                <p className="mt-1 text-xs text-muted-foreground">or click to select multiple files</p>
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json"
                  multiple
                  className="hidden"
                  onChange={(e) => handleJsonFiles(e.target.files)}
                />
              </label>

              {/* File list */}
              {boxFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {boxFiles.map((f) => (
                    <div
                      key={f.name}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                        f.error ? "border-red-500/20 bg-red-500/5" : "border-border bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileJson className={`h-4 w-4 shrink-0 ${f.error ? "text-red-400" : "text-accent"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{f.name}</p>
                          {f.error ? (
                            <p className="text-xs text-red-400">{f.error}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {f.records.length} record{f.records.length !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeBoxFile(f.name)}
                        className="ml-4 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  {totalJsonRecords > 0 && (
                    <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        <span className="text-sm">
                          <span className="font-medium text-foreground">{totalJsonRecords}</span> albums across{" "}
                          {boxFiles.filter((f) => !f.error).length} file{boxFiles.filter((f) => !f.error).length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Pricing pre-loaded · No fetch needed</p>
                    </div>
                  )}
                </div>
              )}

              {/* Preview table */}
              {totalJsonRecords > 0 && (
                <div className="mt-4 rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Artist</TableHead>
                        <TableHead>Genre</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead className="text-right">Est. Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {boxFiles
                        .filter((f) => !f.error)
                        .flatMap((f) => f.records as Array<Record<string, unknown>>)
                        .slice(0, 8)
                        .map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="max-w-[180px] truncate">{String(r.title ?? "—")}</TableCell>
                            <TableCell className="max-w-[140px] truncate">{String(r.artist ?? "—")}</TableCell>
                            <TableCell>{String(r.genre ?? "—")}</TableCell>
                            <TableCell>{String(r.condition ?? "—")}</TableCell>
                            <TableCell className="text-right text-accent tabular-nums">
                              {r.price_low && r.price_high
                                ? `$${Math.round(((Number(r.price_low) + Number(r.price_high)) / 2) * 100) / 100}`
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  {totalJsonRecords > 8 && (
                    <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                      Showing 8 of {totalJsonRecords} records
                    </p>
                  )}
                </div>
              )}

              {jsonImporting && <Progress value={jsonProgress} className="mt-4" />}

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleJsonImport}
                  disabled={jsonImporting || totalJsonRecords === 0}
                >
                  {jsonImporting ? (
                    <><VinylSpinner size="xs" /> Importing...</>
                  ) : (
                    <><Upload className="h-4 w-4" /> Import {totalJsonRecords} Albums</>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center animate-fade-in-up">
              <p className="font-display text-2xl font-bold">
                Successfully imported {jsonResult.count} albums
              </p>
              {jsonResult.skipped > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {jsonResult.skipped} blank/invalid records skipped
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                Pricing from the box analysis is pre-loaded — no fetch required.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button asChild><Link href="/albums">View Catalogue</Link></Button>
                <Button variant="outline" onClick={() => { setBoxFiles([]); setJsonResult(null); }}>
                  Import More
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
