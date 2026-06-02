import type { AlbumCondition } from "@/types";

const DISCOGS_BASE = "https://api.discogs.com";
const USER_AGENT = process.env.DISCOGS_USER_AGENT ?? "VinylVault/1.0";

/**
 * In-process rate limiter for Discogs. Authenticated users get 60 req/min;
 * we keep ourselves comfortably under that ceiling with ~55 req/min.
 */
const MIN_INTERVAL_MS = 1100;
let lastRequestAt = 0;
let queue: Promise<void> = Promise.resolve();

function rateLimit(): Promise<void> {
  queue = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  return queue;
}

class DiscogsError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "DiscogsError";
  }
}

async function discogsFetch<T>(path: string, token: string): Promise<T> {
  await rateLimit();
  const res = await fetch(`${DISCOGS_BASE}${path}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Authorization: `Discogs token=${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (res.status === 429) {
    throw new DiscogsError(
      429,
      "Discogs rate limit hit. Wait a minute and retry."
    );
  }
  if (res.status === 401) {
    throw new DiscogsError(
      401,
      "Discogs token is invalid. Generate a new personal access token."
    );
  }
  if (res.status === 404) {
    throw new DiscogsError(404, "Discogs resource not found.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new DiscogsError(
      res.status,
      `Discogs ${res.status}: ${body.slice(0, 200)}`
    );
  }
  return res.json() as Promise<T>;
}

interface DiscogsSearchResult {
  results?: Array<{
    id: number;
    title?: string;
    year?: string | number;
    format?: string[];
    catno?: string;
    country?: string;
    community?: { want?: number; have?: number };
  }>;
}

interface DiscogsStats {
  num_for_sale?: number;
  lowest_price?: { value: number; currency: string } | null;
  blocked_from_sale?: boolean;
}

type DiscogsPriceSuggestions = Record<
  string,
  { value: number; currency: string } | undefined
>;

/**
 * Maps VinylVault's 5-tier condition scale onto Discogs's 8-grade scale,
 * ordered best-match first. Discogs uses these exact keys in
 * /marketplace/price_suggestions/:release_id responses.
 */
const DISCOGS_GRADE_FOR_CONDITION: Record<AlbumCondition, string[]> = {
  Mint: ["Mint (M)", "Near Mint (NM or M-)"],
  Great: ["Near Mint (NM or M-)", "Very Good Plus (VG+)"],
  Good: ["Very Good Plus (VG+)", "Very Good (VG)", "Good Plus (G+)"],
  Fair: ["Good Plus (G+)", "Good (G)", "Fair (F)"],
  Poor: ["Poor (P)", "Fair (F)", "Good (G)"],
};

type SearchResult = NonNullable<DiscogsSearchResult["results"]>[number];

export interface DiscogsPriceResult {
  releaseId?: number;
  releaseTitle?: string;
  releaseYear?: string;
  /** Best price match for the album's condition, or median of all grades. */
  median?: number;
  /** Lowest active asking price right now. */
  lowest?: number;
  /** How many copies are currently for sale. */
  numForSale?: number;
  /** Suggested price for the exact condition we requested (if found). */
  priceForCondition?: number;
  /** Full Discogs grade breakdown, e.g. {"Mint (M)": 25.00, ...} */
  allConditionPrices?: Record<string, number>;
  /** Which search variant produced the match (for diagnostics). */
  matchedVia?: string;
  /** Every search variant we tried (for diagnostics when nothing matched). */
  attemptedQueries?: string[];
  /** Human-readable error if we couldn't fetch pricing. */
  error?: string;
}

/**
 * Normalize a catalog # into common variants Discogs might have stored.
 * "SP 2166" → ["SP 2166", "SP2166", "SP-2166"]
 */
function normalizeCatalog(catno: string): string[] {
  const trimmed = catno.trim();
  if (!trimmed) return [];
  const variants = new Set<string>([trimmed]);
  variants.add(trimmed.replace(/[\s_]+/g, ""));
  variants.add(trimmed.replace(/[\s_-]+/g, ""));
  variants.add(trimmed.replace(/\s+/g, "-"));
  variants.add(trimmed.toUpperCase());
  return Array.from(variants).filter(Boolean);
}

/**
 * Generate artist-name variants. Discogs sometimes credits an album as just
 * "Hollywood Flames" even if the cover says "The Hollywood Flames".
 */
function artistVariants(artist: string): string[] {
  const base = artist.trim();
  if (!base) return [];
  const variants = new Set<string>([base]);
  if (/^the\s+/i.test(base)) variants.add(base.replace(/^the\s+/i, "").trim());
  const featStripped = base
    .replace(/\s+(feat\.?|featuring|ft\.?|with)\s+.+/i, "")
    .trim();
  if (featStripped) variants.add(featStripped);
  const ampSplit = base.split(/\s*[&,]\s*/)[0].trim();
  if (ampSplit) variants.add(ampSplit);
  return Array.from(variants).filter(Boolean);
}

/**
 * Generate title variants. Strip parentheticals like "(Remastered)" and
 * leading "The " which Discogs frequently omits from release titles.
 */
function titleVariants(title: string): string[] {
  const base = title.trim();
  if (!base) return [];
  const variants = new Set<string>([base]);
  const noParens = base
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*\[[^\]]*\]/g, "")
    .trim();
  if (noParens) variants.add(noParens);
  if (/^the\s+/i.test(base)) variants.add(base.replace(/^the\s+/i, "").trim());
  return Array.from(variants).filter(Boolean);
}

interface SearchAttempt {
  params: URLSearchParams;
  description: string;
}

function buildAttempts(
  artist: string,
  title: string,
  catno: string | undefined
): SearchAttempt[] {
  const catVariants = catno ? normalizeCatalog(catno) : [];
  const artists = artistVariants(artist);
  const titles = titleVariants(title);
  const attempts: SearchAttempt[] = [];

  const push = (
    description: string,
    fields: Record<string, string>
  ): void => {
    attempts.push({
      params: new URLSearchParams({
        type: "release",
        per_page: "10",
        ...fields,
      }),
      description,
    });
  };

  // ===== 1. Catalog number (most precise — globally unique within a label) =====
  for (const cat of catVariants) {
    for (const a of artists) {
      push(`catno="${cat}" + artist="${a}"`, { catno: cat, artist: a });
    }
  }
  for (const cat of catVariants) {
    push(`catno="${cat}" alone`, { catno: cat });
  }

  // ===== 2. Full-text q= (most forgiving — handles spelling/punctuation drift) =====
  for (const a of artists) {
    for (const t of titles) {
      push(`q="${a} ${t}" + Vinyl`, { q: `${a} ${t}`, format: "Vinyl" });
    }
  }
  for (const a of artists) {
    for (const t of titles) {
      push(`q="${a} ${t}"`, { q: `${a} ${t}` });
    }
  }

  // ===== 3. Structured artist + title (strict matchers) =====
  for (const a of artists) {
    for (const t of titles) {
      push(`artist="${a}" + title="${t}" + Vinyl`, {
        artist: a,
        release_title: t,
        format: "Vinyl",
      });
    }
  }
  for (const a of artists) {
    for (const t of titles) {
      push(`artist="${a}" + title="${t}"`, {
        artist: a,
        release_title: t,
      });
    }
  }

  // ===== 4. Title-only fallback (when title is distinctive) =====
  for (const t of titles) {
    push(`q="${t}" + Vinyl`, { q: t, format: "Vinyl" });
  }

  // Dedupe by full param signature, cap at 12 so we don't blow rate limits.
  const seen = new Set<string>();
  return attempts
    .filter((a) => {
      const sig = a.params.toString();
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    })
    .slice(0, 12);
}

/**
 * Rank candidate results to pick the most likely match. We prefer:
 *   1. Vinyl/LP formats over CD/cassette/digital
 *   2. Exact catalog # match (when we have one to compare against)
 *   3. Higher "have" count (more collected = more popular pressing)
 */
function rankResults(
  results: SearchResult[],
  catalogHint?: string
): SearchResult {
  const normHint = catalogHint?.replace(/[\s_-]+/g, "").toUpperCase();
  return results.slice().sort((a, b) => {
    const aVinyl = a.format?.some((f) => /vinyl|lp/i.test(f)) ? 1 : 0;
    const bVinyl = b.format?.some((f) => /vinyl|lp/i.test(f)) ? 1 : 0;
    if (aVinyl !== bVinyl) return bVinyl - aVinyl;

    if (normHint) {
      const aCat = a.catno?.replace(/[\s_-]+/g, "").toUpperCase();
      const bCat = b.catno?.replace(/[\s_-]+/g, "").toUpperCase();
      const aMatch = aCat === normHint ? 1 : 0;
      const bMatch = bCat === normHint ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
    }

    const aHave = a.community?.have ?? 0;
    const bHave = b.community?.have ?? 0;
    return bHave - aHave;
  })[0];
}

export interface DiscogsSearchOutcome {
  match: SearchResult | null;
  matchedVia?: string;
  attempts: string[];
}

export async function searchDiscogsRelease(
  artist: string,
  title: string,
  catalogNumber: string | undefined,
  token: string
): Promise<DiscogsSearchOutcome> {
  const attempts = buildAttempts(artist, title, catalogNumber);
  const tried: string[] = [];

  for (const attempt of attempts) {
    tried.push(attempt.description);
    const data = await discogsFetch<DiscogsSearchResult>(
      `/database/search?${attempt.params.toString()}`,
      token
    );
    const results = data.results ?? [];
    if (results.length === 0) continue;

    const best = rankResults(results, catalogNumber);
    if (best) {
      return { match: best, matchedVia: attempt.description, attempts: tried };
    }
  }

  return { match: null, attempts: tried };
}

export async function fetchMarketplaceStats(
  releaseId: number,
  token: string
): Promise<DiscogsStats | null> {
  try {
    return await discogsFetch<DiscogsStats>(
      `/marketplace/stats/${releaseId}`,
      token
    );
  } catch (err) {
    if (err instanceof DiscogsError && err.status === 404) return null;
    throw err;
  }
}

export async function fetchPriceSuggestions(
  releaseId: number,
  token: string
): Promise<DiscogsPriceSuggestions | null> {
  try {
    return await discogsFetch<DiscogsPriceSuggestions>(
      `/marketplace/price_suggestions/${releaseId}`,
      token
    );
  } catch (err) {
    // 404 here means Discogs has no marketplace data for this release — common
    // for very rare or very new pressings. Treat as soft miss.
    if (err instanceof DiscogsError && (err.status === 404 || err.status === 403)) {
      return null;
    }
    throw err;
  }
}

export function pickPriceForCondition(
  suggestions: DiscogsPriceSuggestions,
  condition: AlbumCondition
): number | undefined {
  for (const grade of DISCOGS_GRADE_FOR_CONDITION[condition]) {
    const entry = suggestions[grade];
    if (entry?.value && entry.value > 0) return entry.value;
  }
  return undefined;
}

/**
 * One-shot helper: search for the release, then fetch both stats and
 * condition-specific price suggestions in parallel. Returns a populated
 * `DiscogsPriceResult` or `{ error }` if anything went wrong.
 */
export async function fetchDiscogsPricing(
  artist: string,
  title: string,
  catalogNumber: string | undefined,
  condition: AlbumCondition,
  token: string
): Promise<DiscogsPriceResult> {
  let outcome: DiscogsSearchOutcome;
  try {
    outcome = await searchDiscogsRelease(artist, title, catalogNumber, token);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Discogs search failed",
    };
  }

  if (!outcome.match) {
    return {
      error: `No Discogs match for "${artist} – ${title}"${
        catalogNumber ? ` (cat# ${catalogNumber})` : ""
      }. Tried ${outcome.attempts.length} search variants. Try trimming parentheticals from the title, removing "The " from the artist, or double-checking the catalog #.`,
      attemptedQueries: outcome.attempts,
    };
  }

  const match = outcome.match;
  const releaseId = match.id;

  let stats: DiscogsStats | null = null;
  let suggestions: DiscogsPriceSuggestions | null = null;
  try {
    [stats, suggestions] = await Promise.all([
      fetchMarketplaceStats(releaseId, token),
      fetchPriceSuggestions(releaseId, token),
    ]);
  } catch (err) {
    return {
      releaseId,
      releaseTitle: match.title,
      releaseYear: match.year != null ? String(match.year) : undefined,
      matchedVia: outcome.matchedVia,
      error: err instanceof Error ? err.message : "Discogs fetch failed",
    };
  }

  const allConditionPrices: Record<string, number> = {};
  if (suggestions) {
    for (const [grade, entry] of Object.entries(suggestions)) {
      if (entry?.value && entry.value > 0) {
        allConditionPrices[grade] = Math.round(entry.value * 100) / 100;
      }
    }
  }

  const priceForCondition = suggestions
    ? pickPriceForCondition(suggestions, condition)
    : undefined;

  let median = priceForCondition;
  if (median == null) {
    const values = Object.values(allConditionPrices).sort((a, b) => a - b);
    if (values.length > 0) {
      median = values[Math.floor(values.length / 2)];
    }
  }

  return {
    releaseId,
    releaseTitle: match.title,
    releaseYear: match.year != null ? String(match.year) : undefined,
    matchedVia: outcome.matchedVia,
    median: median != null ? Math.round(median * 100) / 100 : undefined,
    lowest: stats?.lowest_price?.value
      ? Math.round(stats.lowest_price.value * 100) / 100
      : undefined,
    numForSale: stats?.num_for_sale,
    priceForCondition:
      priceForCondition != null
        ? Math.round(priceForCondition * 100) / 100
        : undefined,
    allConditionPrices,
  };
}

// ============================================================================
// Discogs Marketplace — listing management
// ============================================================================

const CONDITION_TO_DISCOGS_GRADE: Record<AlbumCondition, string> = {
  Mint: "Mint (M)",
  Great: "Near Mint (NM or M-)",
  Good: "Very Good Plus (VG+)",
  Fair: "Good (G)",
  Poor: "Poor (P)",
};

async function discogsPost<T>(
  path: string,
  body: unknown,
  token: string
): Promise<T> {
  await rateLimit();
  const res = await fetch(`${DISCOGS_BASE}${path}`, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Authorization: `Discogs token=${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (res.status === 429) throw new DiscogsError(429, "Discogs rate limit hit.");
  if (res.status === 401) throw new DiscogsError(401, "Discogs token is invalid.");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new DiscogsError(res.status, `Discogs ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function discogsDelete(path: string, token: string): Promise<void> {
  await rateLimit();
  const res = await fetch(`${DISCOGS_BASE}${path}`, {
    method: "DELETE",
    headers: {
      "User-Agent": USER_AGENT,
      Authorization: `Discogs token=${token}`,
    },
    cache: "no-store",
  });

  if (res.status === 429) throw new DiscogsError(429, "Discogs rate limit hit.");
  if (res.status === 401) throw new DiscogsError(401, "Discogs token is invalid.");
  if (res.status === 404) return; // already gone
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new DiscogsError(res.status, `Discogs ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function createDiscogsListing(params: {
  releaseId: number;
  condition: AlbumCondition;
  price: number;
  token: string;
  comments?: string;
}): Promise<{ listingId: number; listingUrl: string }> {
  const grade = CONDITION_TO_DISCOGS_GRADE[params.condition];
  const data = await discogsPost<{ listing_id: number; resource_url: string }>(
    "/marketplace/listings",
    {
      release_id: params.releaseId,
      condition: grade,
      sleeve_condition: grade,
      price: params.price,
      status: "For Sale",
      comments: params.comments ?? "Ships from USA. Securely packed.",
    },
    params.token
  );
  return {
    listingId: data.listing_id,
    listingUrl: `https://www.discogs.com/sell/item/${data.listing_id}`,
  };
}

export async function deleteDiscogsListing(
  listingId: number,
  token: string
): Promise<void> {
  await discogsDelete(`/marketplace/listings/${listingId}`, token);
}

export async function getDiscogsListingStatus(
  listingId: number,
  token: string
): Promise<{ status: string; price: number } | null> {
  try {
    const data = await discogsFetch<{ status: string; price: { value: number } }>(
      `/marketplace/listings/${listingId}`,
      token
    );
    return { status: data.status, price: data.price?.value ?? 0 };
  } catch (err) {
    if (err instanceof DiscogsError && err.status === 404) return null;
    throw err;
  }
}

export async function testDiscogsConnection(token: string): Promise<boolean> {
  try {
    await discogsFetch<{ id: number }>(`/oauth/identity`, token);
    return true;
  } catch {
    return false;
  }
}
