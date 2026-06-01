"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
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

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [headerless, setHeaderless] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [showAllErrors, setShowAllErrors] = useState(false);

  const { rows, errors, invalidCount } = useMemo(
    () => deriveRows(rawRows, columnMapping),
    [rawRows, columnMapping]
  );

  const mappedTargets = useMemo(
    () => new Set(Object.values(columnMapping).filter((v) => v !== "skip")),
    [columnMapping]
  );
  const missingRequired = REQUIRED_TARGETS.filter(
    (t) => !mappedTargets.has(t)
  );

  async function handleFileSelect(selectedFile: File) {
    setFile(selectedFile);
    setParseError(null);
    setShowAllErrors(false);
    const result = await parseAlbumCSV(selectedFile);
    setHeaders(result.headers);
    setRawRows(result.rawRows);
    setColumnMapping(result.detectedMapping);
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
    setColumnMapping(result.detectedMapping);
    setHeaderless(result.headerless);
  }

  function handleContinue() {
    if (step === 0 && file && rawRows.length > 0) {
      setStep(1);
    } else if (step === 1 && rows.length > 0) {
      setStep(2);
      handleImport();
    }
  }

  async function handleImport() {
    setImporting(true);
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
        toast.error(data.error ?? "Import failed");
        setImporting(false);
        return;
      }

      const data = await res.json();
      setImportedCount(data.count);
      setProgress(100);
      toast.success(`Imported ${data.count} albums`);
    } catch {
      toast.error("Import failed");
    }
    setImporting(false);
  }

  const visibleErrors = showAllErrors ? errors : errors.slice(0, 5);
  const allRowsFailed = rawRows.length > 0 && rows.length === 0;

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-3xl font-bold">Import CSV</h1>

      <div className="mx-auto mt-8 flex max-w-md items-center justify-center">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${
                  i <= step
                    ? "bg-accent text-black scale-110"
                    : "bg-[#1A1A1C] text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span className="mt-1 text-xs text-muted-foreground">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-4 h-0.5 w-16 transition-colors duration-500 ${
                  i < step ? "bg-accent" : "bg-[#1A1A1C]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-3xl">
        {step === 0 && (
          <>
            <CSVDropzone onFileSelect={handleFileSelect} selectedFile={file} />
            {parseError && (
              <p className="mt-4 text-sm text-red-400">{parseError}</p>
            )}
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
            <div className="mb-6 rounded-xl border border-white/8 bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-base font-semibold">
                  Column mapping
                </p>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={headerless}
                    onChange={(e) => reparseAs(!e.target.checked)}
                    className="h-3.5 w-3.5 cursor-pointer accent-[#D4A843]"
                  />
                  First row is data, not headers
                </label>
              </div>

              {headerless && (
                <p className="mb-3 text-xs text-muted-foreground">
                  No header row detected — columns are guessed by position
                  (Title, Artist, Genre, Condition, Catalog #). Adjust below
                  if the order is different.
                </p>
              )}

              {missingRequired.length > 0 && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Missing required mapping{missingRequired.length > 1 ? "s" : ""}:{" "}
                    {missingRequired
                      .map((t) => TARGET_FIELDS.find((f) => f.key === t)?.label)
                      .join(", ")}
                    . Pick a column below.
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {headers.map((h) => {
                  const sample = rawRows[0]?.[h] ?? "";
                  const value = columnMapping[h] ?? "skip";
                  const isDuplicate =
                    value !== "skip" &&
                    Object.entries(columnMapping).filter(
                      ([k, v]) => v === value && k !== h
                    ).length > 0;
                  return (
                    <div key={h} className="grid grid-cols-[1fr_auto_220px] items-center gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{h}</p>
                        {sample && (
                          <p className="truncate text-xs text-muted-foreground">
                            e.g. {sample}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">→</span>
                      <Select
                        value={value}
                        onValueChange={(v) =>
                          setColumnMapping((prev) => ({ ...prev, [h]: v }))
                        }
                      >
                        <SelectTrigger
                          className={
                            isDuplicate
                              ? "border-amber-500/40"
                              : value === "skip"
                                ? "border-white/10 text-muted-foreground"
                                : "border-accent/40"
                          }
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TARGET_FIELDS.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label}
                              {f.required ? " *" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-4 flex items-center gap-3 rounded-lg border border-white/8 bg-card px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-sm">
                <span className="font-medium text-[#F5F4F0]">{rows.length}</span>{" "}
                of {rawRows.length} rows ready to import
              </span>
              {invalidCount > 0 && (
                <span className="ml-auto text-xs text-amber-400">
                  {invalidCount} skipped due to validation errors
                </span>
              )}
            </div>

            {errors.length > 0 && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-sm font-medium text-red-400">
                  {errors.length} validation error{errors.length > 1 ? "s" : ""}
                </p>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-2">
                  {visibleErrors.map((err, i) => (
                    <li key={i} className="text-xs text-red-400">
                      {err}
                    </li>
                  ))}
                </ul>
                {errors.length > 5 && (
                  <button
                    onClick={() => setShowAllErrors((v) => !v)}
                    className="mt-2 text-xs text-accent hover:underline"
                  >
                    {showAllErrors
                      ? "Show less"
                      : `Show all ${errors.length} errors`}
                  </button>
                )}
                {allRowsFailed && (
                  <p className="mt-3 border-t border-red-500/20 pt-3 text-xs text-red-300">
                    All rows failed. Double-check the column mapping above —
                    usually this means a required field is unmapped or the
                    Condition column uses values we don&apos;t recognize.
                  </p>
                )}
              </div>
            )}

            <div className="rounded-xl border border-white/8">
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
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No valid rows yet — adjust the column mapping above.
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

            {rows.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Showing {Math.min(rows.length, 10)} of {rows.length} valid rows
              </p>
            )}

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                onClick={handleContinue}
                disabled={rows.length === 0}
              >
                Import {rows.length} Album{rows.length === 1 ? "" : "s"}
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="text-center animate-fade-in">
            {importing ? (
              <>
                <div className="flex justify-center">
                  <VinylSpinner size="xl" />
                </div>
                <p className="mt-6 text-lg font-medium">Importing albums...</p>
                <Progress value={progress} className="mt-4" />
              </>
            ) : (
              <div className="animate-fade-in-up">
                <p className="font-display text-2xl font-bold">
                  Successfully imported {importedCount} albums
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <Button asChild>
                    <Link href="/albums">Go to Catalogue</Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/albums?action=price-all")}
                  >
                    Price All Now
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
