import Papa from "papaparse";
import type { AlbumCondition, CSVAlbumRow } from "@/types";

/**
 * Header aliases. Keys are the SNAKE_CASE normalized form of common header
 * variants seen across user CSVs (Discogs export, eBay sold listing exports,
 * Excel templates). Values are our canonical field names.
 */
const HEADER_ALIASES: Record<string, string> = {
  // Title
  album_title: "title",
  album: "title",
  album_name: "title",
  title: "title",
  release_title: "title",
  name: "title",

  // Artist
  artist: "artist",
  artists: "artist",
  band: "artist",
  performer: "artist",
  artist_name: "artist",

  // Genre
  genre: "genre",
  genres: "genre",
  style: "genre",
  styles: "genre",
  category: "genre",

  // Condition
  condition: "condition",
  grade: "condition",
  media_condition: "condition",
  "collection_media_condition": "condition",
  record_condition: "condition",
  vinyl_condition: "condition",
  disc_condition: "condition",

  // Catalog number
  catalog_number: "catalog_number",
  "catalog#": "catalog_number",
  catalog: "catalog_number",
  catalog_no: "catalog_number",
  cat_no: "catalog_number",
  catalogue_number: "catalog_number",
  label_catalog: "catalog_number",
  release_id: "catalog_number",

  // Notes
  notes: "notes",
  note: "notes",
  comments: "notes",
  description: "notes",
  collection_notes: "notes",

  // Purchase price
  purchase_price: "purchase_price",
  price_paid: "purchase_price",
  cost: "purchase_price",
  paid: "purchase_price",
};

const VALID_CONDITIONS: AlbumCondition[] = [
  "Mint",
  "Great",
  "Good",
  "Fair",
  "Poor",
];

/**
 * Map common condition value strings to our canonical enum. Covers Discogs
 * grading (M, NM, VG+, VG, G+, G, F, P) and the parenthesized variants
 * Discogs writes when exporting ("Very Good Plus (VG+)").
 */
const CONDITION_VALUE_ALIASES: Record<string, AlbumCondition> = {
  m: "Mint",
  mint: "Mint",
  "m-": "Mint",
  nm: "Mint",
  "near mint": "Mint",
  "near mint (nm or m-)": "Mint",
  sealed: "Mint",
  new: "Mint",

  "vg+": "Great",
  "vg plus": "Great",
  "very good plus": "Great",
  "very good plus (vg+)": "Great",
  great: "Great",
  excellent: "Great",

  vg: "Good",
  "very good": "Good",
  "very good (vg)": "Good",
  "g+": "Good",
  "good plus": "Good",
  "good plus (g+)": "Good",
  good: "Good",
  "good (g)": "Good",

  fair: "Fair",
  f: "Fair",
  "fair (f)": "Fair",
  acceptable: "Fair",

  poor: "Poor",
  p: "Poor",
  "poor (p)": "Poor",
  bad: "Poor",
};

export function normalizeCondition(raw: string | undefined): AlbumCondition | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if ((VALID_CONDITIONS as string[]).includes(trimmed)) {
    return trimmed as AlbumCondition;
  }

  const lower = trimmed.toLowerCase();
  if (CONDITION_VALUE_ALIASES[lower]) {
    return CONDITION_VALUE_ALIASES[lower];
  }

  // Try matching just the parenthetical short code, e.g. "Some prefix (VG+)".
  const parenMatch = lower.match(/\(([^)]+)\)\s*$/);
  if (parenMatch && CONDITION_VALUE_ALIASES[parenMatch[1]]) {
    return CONDITION_VALUE_ALIASES[parenMatch[1]];
  }

  return null;
}

export function normalizeHeader(header: string): string {
  // Strip BOM that sometimes prefixes the first column header in CSVs saved
  // from Excel/Sheets/Discogs.
  const cleaned = header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return HEADER_ALIASES[cleaned] ?? cleaned;
}

export const TARGET_FIELDS = [
  { key: "title", label: "Title", required: true },
  { key: "artist", label: "Artist", required: true },
  { key: "condition", label: "Condition", required: true },
  { key: "genre", label: "Genre", required: false },
  { key: "catalog_number", label: "Catalog #", required: false },
  { key: "notes", label: "Notes", required: false },
  { key: "purchase_price", label: "Purchase Price", required: false },
  { key: "skip", label: "Skip column", required: false },
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number]["key"];

export interface ParsedCSVResult {
  rows: CSVAlbumRow[];
  rawRows: Record<string, string>[];
  headers: string[];
  detectedMapping: Record<string, string>;
  errors: string[];
  /** True when we detected the file has no header row and synthesized columns. */
  headerless: boolean;
}

export interface DerivedRowsResult {
  rows: CSVAlbumRow[];
  errors: string[];
  invalidCount: number;
}

/**
 * Default positional layout for headerless CSVs. Matches the example format
 * documented in README ("album_title, artist, genre, condition, catalog_number"
 * plus optional notes and purchase_price).
 */
const HEADERLESS_DEFAULT_ORDER: TargetField[] = [
  "title",
  "artist",
  "genre",
  "condition",
  "catalog_number",
  "notes",
  "purchase_price",
];

function looksLikeHeaderRow(headers: string[]): boolean {
  if (headers.length === 0) return false;
  // A real header row will usually contain at least one column whose
  // normalized form matches one of our known aliases (title/artist/condition
  // etc.), or contains "snake_case" / lower-case ASCII words.
  let aliasHits = 0;
  let conditionValueHits = 0;
  let multiWordHits = 0;
  for (const h of headers) {
    const norm = normalizeHeader(h);
    if (TARGET_FIELDS.some((f) => f.key === norm)) {
      aliasHits++;
      continue;
    }
    // If a "header" cell parses as a known condition grade, this is data.
    if (normalizeCondition(h)) conditionValueHits++;
    // If a "header" is multi-word with capitalized words (e.g. "Buzz Buzz Buzz"),
    // it's almost certainly data, not a header.
    if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(h.trim())) multiWordHits++;
  }
  if (aliasHits >= 1) return true;
  if (conditionValueHits > 0) return false;
  if (multiWordHits >= 2) return false;
  // Fallback: assume header row only if more than half of the headers look
  // like single-word identifiers.
  const identifierLike = headers.filter((h) =>
    /^[a-z0-9_\s#]+$/i.test(h.trim()) && h.trim().split(/\s+/).length <= 3
  ).length;
  return identifierLike > headers.length / 2;
}

function parseWithHeaderRow(file: File): Promise<ParsedCSVResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        const rawRows = results.data ?? [];

        const detectedMapping: Record<string, string> = {};
        const usedTargets = new Set<string>();
        headers.forEach((h) => {
          const normalized = normalizeHeader(h);
          const matchedTarget = TARGET_FIELDS.find((f) => f.key === normalized);
          if (matchedTarget && !usedTargets.has(matchedTarget.key)) {
            detectedMapping[h] = matchedTarget.key;
            usedTargets.add(matchedTarget.key);
          } else {
            detectedMapping[h] = "skip";
          }
        });

        const { rows, errors } = deriveRows(rawRows, detectedMapping);
        resolve({
          rows,
          rawRows,
          headers,
          detectedMapping,
          errors,
          headerless: false,
        });
      },
      error: (error) => {
        resolve({
          rows: [],
          rawRows: [],
          headers: [],
          detectedMapping: {},
          errors: [error.message],
          headerless: false,
        });
      },
    });
  });
}

function parseWithoutHeaderRow(file: File): Promise<ParsedCSVResult> {
  return new Promise((resolve) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const arrayRows = results.data ?? [];
        if (arrayRows.length === 0) {
          resolve({
            rows: [],
            rawRows: [],
            headers: [],
            detectedMapping: {},
            errors: ["CSV is empty"],
            headerless: true,
          });
          return;
        }

        const columnCount = Math.max(...arrayRows.map((r) => r.length));
        const headers = Array.from(
          { length: columnCount },
          (_, i) => `Column ${i + 1}`
        );

        // Convert array rows → objects so the rest of the pipeline is uniform.
        const rawRows: Record<string, string>[] = arrayRows.map((row) => {
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => {
            const raw = (row[i] ?? "") as unknown;
            obj[h] = typeof raw === "string" ? raw.replace(/^\uFEFF/, "") : "";
          });
          return obj;
        });

        const detectedMapping: Record<string, string> = {};
        headers.forEach((h, i) => {
          detectedMapping[h] = HEADERLESS_DEFAULT_ORDER[i] ?? "skip";
        });

        const { rows, errors } = deriveRows(rawRows, detectedMapping);
        resolve({
          rows,
          rawRows,
          headers,
          detectedMapping,
          errors,
          headerless: true,
        });
      },
      error: (error) => {
        resolve({
          rows: [],
          rawRows: [],
          headers: [],
          detectedMapping: {},
          errors: [error.message],
          headerless: true,
        });
      },
    });
  });
}

/**
 * Parse a CSV file. Auto-detects whether the file has a header row using a
 * combination of alias matches, condition-value detection, and multi-word
 * heuristics. Caller can force the headerless path via `hasHeaderRow: false`.
 */
export async function parseAlbumCSV(
  file: File,
  options: { hasHeaderRow?: boolean } = {}
): Promise<ParsedCSVResult> {
  if (options.hasHeaderRow === false) {
    return parseWithoutHeaderRow(file);
  }
  if (options.hasHeaderRow === true) {
    return parseWithHeaderRow(file);
  }

  // Auto-detect: parse with headers, then check if the detected header row
  // actually looks like a header. If not, re-parse without headers.
  const withHeaders = await parseWithHeaderRow(file);
  if (looksLikeHeaderRow(withHeaders.headers)) {
    return withHeaders;
  }
  return parseWithoutHeaderRow(file);
}

/**
 * Re-derive validated rows + errors from raw CSV rows + a column mapping.
 * Pure, synchronous, safe to call from a useMemo on every keystroke.
 */
export function deriveRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string>
): DerivedRowsResult {
  const errors: string[] = [];
  const rows: CSVAlbumRow[] = [];

  rawRows.forEach((row, index) => {
    const mapped: Record<string, string> = {};
    Object.entries(row).forEach(([originalHeader, value]) => {
      const target = mapping[originalHeader] ?? "skip";
      if (target === "skip") return;
      // Don't overwrite a non-empty value with a later empty one.
      const trimmed = (value ?? "").trim();
      if (mapped[target] && !trimmed) return;
      mapped[target] = trimmed;
    });

    const title = mapped.title;
    const artist = mapped.artist;
    const condition = normalizeCondition(mapped.condition);

    const rowNum = index + 2; // +1 for header row, +1 for 1-indexing
    const rowErrors: string[] = [];
    if (!title) rowErrors.push(`Row ${rowNum}: missing title`);
    if (!artist) rowErrors.push(`Row ${rowNum}: missing artist`);
    if (!mapped.condition) {
      rowErrors.push(`Row ${rowNum}: missing condition`);
    } else if (!condition) {
      rowErrors.push(
        `Row ${rowNum}: unrecognized condition "${mapped.condition}" — use Mint, Great, Good, Fair, or Poor`
      );
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    rows.push({
      title: title!,
      artist: artist!,
      genre: mapped.genre || undefined,
      condition: condition!,
      catalog_number: mapped.catalog_number || undefined,
      notes: mapped.notes || undefined,
      purchase_price: mapped.purchase_price
        ? Number.parseFloat(mapped.purchase_price.replace(/[^0-9.\-]/g, ""))
        : undefined,
    });
  });

  return { rows, errors, invalidCount: rawRows.length - rows.length };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
