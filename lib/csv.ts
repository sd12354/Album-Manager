import Papa from "papaparse";
import type { AlbumCondition, CSVAlbumRow } from "@/types";

/**
 * Header aliases. Keys are the SNAKE_CASE normalized form of common header
 * variants seen across user CSVs (Discogs export, eBay sold listing exports,
 * Excel templates). Values are our canonical field names.
 */
const HEADER_ALIASES: Record<string, string> = {
  // Title — Discogs uses Title; eBay sold listings use "Item Title"; collectors use Album/LP/Record
  album_title: "title",
  album: "title",
  album_name: "title",
  title: "title",
  release_title: "title",
  release: "title",
  release_name: "title",
  name: "title",
  item: "title",
  item_title: "title",
  item_name: "title",
  product: "title",
  product_title: "title",
  record: "title",
  record_title: "title",
  record_name: "title",
  lp: "title",
  lp_title: "title",

  // Artist — Discogs uses Artist; eBay uses "Recording Artist"; some templates use Band
  artist: "artist",
  artists: "artist",
  band: "artist",
  performer: "artist",
  performers: "artist",
  artist_name: "artist",
  artist_band: "artist",
  band_name: "artist",
  recording_artist: "artist",
  recording_artists: "artist",
  artist_or_band: "artist",
  group: "artist",
  group_name: "artist",
  by: "artist",
  creator: "artist",
  composer: "artist",

  // Genre
  genre: "genre",
  genres: "genre",
  style: "genre",
  styles: "genre",
  category: "genre",
  categories: "genre",
  music_genre: "genre",
  music_style: "genre",
  music_category: "genre",
  format_genre: "genre",

  // Condition — Discogs exports "Collection Media Condition"; many use Grade
  condition: "condition",
  cond: "condition",
  grade: "condition",
  grading: "condition",
  media_condition: "condition",
  collection_media_condition: "condition",
  media_grade: "condition",
  record_condition: "condition",
  record_grade: "condition",
  vinyl_condition: "condition",
  vinyl_grade: "condition",
  disc_condition: "condition",
  disc_grade: "condition",
  sleeve_condition: "condition",
  jacket_condition: "condition",
  overall_condition: "condition",
  goldmine_grade: "condition",
  state: "condition",
  quality: "condition",

  // Catalog number
  catalog_number: "catalog_number",
  "catalog#": "catalog_number",
  "cat#": "catalog_number",
  catalog: "catalog_number",
  catalog_no: "catalog_number",
  cat_no: "catalog_number",
  cat_num: "catalog_number",
  catalogue: "catalog_number",
  catalogue_number: "catalog_number",
  catalogue_no: "catalog_number",
  label_catalog: "catalog_number",
  label_catalog_number: "catalog_number",
  label_number: "catalog_number",
  release_id: "catalog_number",
  matrix: "catalog_number",
  matrix_number: "catalog_number",
  sku: "catalog_number",

  // Notes
  notes: "notes",
  note: "notes",
  comments: "notes",
  comment: "notes",
  description: "notes",
  desc: "notes",
  remarks: "notes",
  details: "notes",
  collection_notes: "notes",
  private_notes: "notes",
  seller_notes: "notes",

  // Purchase price — collectors track cost basis many ways
  purchase_price: "purchase_price",
  price_paid: "purchase_price",
  paid_price: "purchase_price",
  cost: "purchase_price",
  cost_basis: "purchase_price",
  paid: "purchase_price",
  bought_for: "purchase_price",
  acquisition_price: "purchase_price",
  buy_price: "purchase_price",
  amount_paid: "purchase_price",
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

/** Strip BOM, lowercase, collapse to snake_case, drop punctuation. */
function canonicalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeHeader(header: string): string {
  const cleaned = canonicalizeHeader(header);
  return HEADER_ALIASES[cleaned] ?? cleaned;
}

/** Damerau-Levenshtein-ish distance, capped to bail early on long inputs. */
function editDistance(a: string, b: string, cap = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

/** Fuzzy-match a canonicalized header against the alias table. */
function fuzzyHeaderMatch(canonical: string): string | null {
  if (canonical.length < 3) return null;
  let best: { target: string; distance: number } | null = null;
  for (const [alias, target] of Object.entries(HEADER_ALIASES)) {
    // Generous enough to catch transposed letters ("titel" → "title") on
    // short words without matching unrelated short strings.
    const tolerance = alias.length <= 4 ? 1 : alias.length <= 8 ? 2 : 3;
    const d = editDistance(canonical, alias, tolerance);
    if (d <= tolerance && (!best || d < best.distance)) {
      best = { target, distance: d };
    }
  }
  return best?.target ?? null;
}

/**
 * Inspect column values to infer what kind of column it is. Used as a
 * tiebreaker when the header is unrecognized \u2014 a column where most values
 * parse as condition grades is almost certainly the condition column even
 * if the header is "State" or blank.
 */
function inferTargetFromValues(values: string[]): string | null {
  const samples = values.map((v) => (v ?? "").trim()).filter(Boolean).slice(0, 50);
  if (samples.length === 0) return null;

  let conditionHits = 0;
  let numericHits = 0;
  let currencyHits = 0;
  for (const v of samples) {
    if (normalizeCondition(v)) conditionHits++;
    if (/^-?\d+(\.\d+)?$/.test(v)) numericHits++;
    if (/^[$\u00A3\u20AC\u00A5]\s?-?\d/.test(v) || /^-?\d+(\.\d{1,2})?\s?(usd|eur|gbp)$/i.test(v)) {
      currencyHits++;
    }
  }
  // Need a clear majority to commit to a guess.
  const threshold = Math.max(2, Math.floor(samples.length * 0.6));
  if (conditionHits >= threshold) return "condition";
  if (currencyHits >= threshold) return "purchase_price";
  if (numericHits >= threshold && samples.length >= 3) return "purchase_price";
  return null;
}

/**
 * Build a header \u2192 target mapping for a parsed CSV. Tries, in order:
 *   1. exact alias match (HEADER_ALIASES)
 *   2. fuzzy alias match (small edit distance, for typos)
 *   3. content-based inference from the column's values
 * Returns whether each header was matched and how, so the UI can flag low-
 * confidence picks for the user to verify.
 */
export interface DetectionDetail {
  target: string;
  via: "alias" | "fuzzy" | "content" | "none";
}

export function detectColumnMapping(
  headers: string[],
  rawRows: Record<string, string>[]
): { mapping: Record<string, string>; detail: Record<string, DetectionDetail> } {
  const mapping: Record<string, string> = {};
  const detail: Record<string, DetectionDetail> = {};
  const usedTargets = new Set<string>();

  // Pass 1 \u2014 exact alias matches.
  headers.forEach((h) => {
    const canonical = canonicalizeHeader(h);
    const hit = HEADER_ALIASES[canonical];
    if (hit && !usedTargets.has(hit)) {
      mapping[h] = hit;
      detail[h] = { target: hit, via: "alias" };
      usedTargets.add(hit);
    }
  });

  // Pass 2 \u2014 fuzzy alias matches for unmapped headers.
  headers.forEach((h) => {
    if (mapping[h]) return;
    const canonical = canonicalizeHeader(h);
    const fuzzy = fuzzyHeaderMatch(canonical);
    if (fuzzy && !usedTargets.has(fuzzy)) {
      mapping[h] = fuzzy;
      detail[h] = { target: fuzzy, via: "fuzzy" };
      usedTargets.add(fuzzy);
    }
  });

  // Pass 3 \u2014 content inference for what's still unmapped (and a target slot is open).
  headers.forEach((h) => {
    if (mapping[h]) return;
    const values = rawRows.map((row) => row[h] ?? "");
    const inferred = inferTargetFromValues(values);
    if (inferred && !usedTargets.has(inferred)) {
      mapping[h] = inferred;
      detail[h] = { target: inferred, via: "content" };
      usedTargets.add(inferred);
    } else {
      mapping[h] = "skip";
      detail[h] = { target: "skip", via: "none" };
    }
  });

  return { mapping, detail };
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
  /**
   * How each column was matched — "alias" is exact, "fuzzy" caught a typo,
   * "content" came from value-based inference, "none" means unmapped (skip).
   */
  detectionDetail: Record<string, DetectionDetail>;
  errors: string[];
  /** True when we detected the file has no header row and synthesized columns. */
  headerless: boolean;
}

export interface DerivedRowsResult {
  rows: CSVAlbumRow[];
  errors: string[];
  invalidCount: number;
}

interface DeriveRowsOptions {
  firstDataRowNumber?: number;
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

        const { mapping: detectedMapping, detail: detectionDetail } =
          detectColumnMapping(headers, rawRows);

        const { rows, errors } = deriveRows(rawRows, detectedMapping);
        resolve({
          rows,
          rawRows,
          headers,
          detectedMapping,
          detectionDetail,
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
          detectionDetail: {},
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
            detectionDetail: {},
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
        const detectionDetail: Record<string, DetectionDetail> = {};
        headers.forEach((h, i) => {
          const target = HEADERLESS_DEFAULT_ORDER[i] ?? "skip";
          detectedMapping[h] = target;
          detectionDetail[h] = { target, via: target === "skip" ? "none" : "alias" };
        });

        const { rows, errors } = deriveRows(rawRows, detectedMapping, {
          firstDataRowNumber: 1,
        });
        resolve({
          rows,
          rawRows,
          headers,
          detectedMapping,
          detectionDetail,
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
          detectionDetail: {},
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
  mapping: Record<string, string>,
  options: DeriveRowsOptions = {}
): DerivedRowsResult {
  const errors: string[] = [];
  const rows: CSVAlbumRow[] = [];
  const firstDataRowNumber = options.firstDataRowNumber ?? 2;

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

    const rowNum = firstDataRowNumber + index;
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

    let purchasePrice: number | undefined;
    if (mapped.purchase_price) {
      purchasePrice = Number.parseFloat(
        mapped.purchase_price.replace(/[^0-9.\-]/g, "")
      );
      if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
        rowErrors.push(
          `Row ${rowNum}: invalid purchase price "${mapped.purchase_price}"`
        );
      }
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
      purchase_price: purchasePrice,
    });
  });

  return { rows, errors, invalidCount: rawRows.length - rows.length };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
