import type { AlbumCondition } from "@/types";
import {
  buildOAuthAuthorizationHeader,
  getDiscogsOAuthConfig,
} from "@/lib/discogs-oauth";

const DISCOGS_BASE = "https://api.discogs.com";
const USER_AGENT = process.env.DISCOGS_USER_AGENT ?? "VinylVault/1.0";

/**
 * Discogs auth — either a personal access token (legacy) or an OAuth 1.0a
 * token pair (token + secret). A plain string is treated as a personal token.
 */
export interface DiscogsAuth {
  token: string;
  tokenSecret?: string;
}

export type DiscogsAuthInput = string | DiscogsAuth;

function normalizeDiscogsAuth(auth: DiscogsAuthInput): DiscogsAuth {
  return typeof auth === "string" ? { token: auth } : auth;
}

/** Build the right Authorization header for token or OAuth 1.0a auth. */
function buildDiscogsAuthHeader(auth: DiscogsAuthInput): string {
  const normalized = normalizeDiscogsAuth(auth);
  if (normalized.tokenSecret) {
    const config = getDiscogsOAuthConfig();
    if (!config) {
      throw new DiscogsError(
        500,
        "Discogs OAuth is not configured on the server (missing DISCOGS_CONSUMER_KEY / DISCOGS_CONSUMER_SECRET)."
      );
    }
    return buildOAuthAuthorizationHeader({
      consumerKey: config.consumerKey,
      consumerSecret: config.consumerSecret,
      token: normalized.token,
      tokenSecret: normalized.tokenSecret,
    });
  }
  return `Discogs token=${normalized.token}`;
}

/**
 * Resolve Discogs auth that belongs to a specific user. Use this for account
 * connection status and all write/status marketplace operations.
 */
export function resolveUserDiscogsAuth(
  userMetadata: Record<string, unknown> | null | undefined
): DiscogsAuth | null {
  const meta = (userMetadata ?? {}) as {
    discogs_oauth_token?: string;
    discogs_oauth_token_secret?: string;
    discogs_token?: string;
  };
  if (meta.discogs_oauth_token && meta.discogs_oauth_token_secret) {
    return {
      token: meta.discogs_oauth_token,
      tokenSecret: meta.discogs_oauth_token_secret,
    };
  }
  if (meta.discogs_token) return { token: meta.discogs_token };
  return null;
}

/**
 * Resolve the Discogs auth for pricing flows, falling back to the server-wide
 * personal token. OAuth takes precedence over a pasted personal token, which
 * takes precedence over the env token.
 */
export function resolveDiscogsAuth(
  userMetadata: Record<string, unknown> | null | undefined
): DiscogsAuth | null {
  const userAuth = resolveUserDiscogsAuth(userMetadata);
  if (userAuth) return userAuth;
  const envToken = process.env.DISCOGS_PERSONAL_ACCESS_TOKEN;
  if (envToken) return { token: envToken };
  return null;
}

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

export class DiscogsError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "DiscogsError";
  }
}

/**
 * Lightweight structured logger so Discogs failures are diagnosable in
 * production logs (e.g. Vercel). Mirrors the visibility we have for eBay.
 */
function logDiscogs(
  level: "info" | "warn" | "error",
  event: string,
  detail?: Record<string, unknown>
): void {
  const payload = { scope: "discogs", event, ...detail };
  if (level === "error") console.error("[discogs]", payload);
  else if (level === "warn") console.warn("[discogs]", payload);
  else console.log("[discogs]", payload);
}

/**
 * Discogs returns errors as JSON `{ "message": "..." }`. Pull that out so we
 * surface the real reason instead of a raw body blob.
 */
function extractDiscogsMessage(body: string): string | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed?.message) return parsed.message;
  } catch {
    // Not JSON — fall through to raw text.
  }
  return body.slice(0, 200);
}

/**
 * Turn a non-OK response into a DiscogsError with a clean, actionable message.
 * Reads the body exactly once and logs the failure with full context.
 */
async function discogsErrorFromResponse(
  res: Response,
  method: string,
  path: string
): Promise<DiscogsError> {
  const body = await res.text().catch(() => "");
  const apiMessage = extractDiscogsMessage(body);

  let message: string;
  switch (res.status) {
    case 401:
      message =
        "Discogs token is invalid. Generate a new personal access token in Settings.";
      break;
    case 403:
      message =
        apiMessage && !/permission to access/i.test(apiMessage)
          ? apiMessage
          : "Discogs rejected this action. Your account isn't set up to sell yet — " +
            "add a payment method and shipping policy at discogs.com/settings/seller, then retry.";
      break;
    case 404:
      message = "Discogs resource not found.";
      break;
    case 422:
      message = apiMessage
        ? `Discogs rejected the listing data: ${apiMessage}`
        : "Discogs rejected the listing data (validation error).";
      break;
    case 429:
      message = "Discogs rate limit hit. Wait a minute and retry.";
      break;
    default:
      message = apiMessage
        ? `Discogs ${res.status}: ${apiMessage}`
        : `Discogs ${res.status} error.`;
  }

  logDiscogs("error", "request_failed", {
    method,
    path,
    status: res.status,
    apiMessage,
  });

  return new DiscogsError(res.status, message);
}

async function discogsFetch<T>(path: string, auth: DiscogsAuthInput): Promise<T> {
  await rateLimit();
  const res = await fetch(`${DISCOGS_BASE}${path}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Authorization: buildDiscogsAuthHeader(auth),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) throw await discogsErrorFromResponse(res, "GET", path);
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
    cover_image?: string;
    thumb?: string;
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
  token: DiscogsAuthInput
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

export interface DiscogsReleaseCandidate {
  id: number;
  artist: string;
  title: string;
  catalogNumber?: string;
  coverImage?: string;
  year?: string;
}

/**
 * Discogs search "title" fields come back as "Artist - Title" (with optional
 * "(2)" disambiguation suffixes on the artist). Split into clean parts.
 */
function splitArtistTitle(combined: string): { artist: string; title: string } {
  const idx = combined.indexOf(" - ");
  if (idx === -1) return { artist: "", title: combined.trim() };
  const artist = combined
    .slice(0, idx)
    .replace(/\s*\(\d+\)\s*$/, "")
    .trim();
  const title = combined.slice(idx + 3).trim();
  return { artist, title };
}

/**
 * Search Discogs for the top release candidates matching the (possibly noisy,
 * OCR-derived) artist/title, returning each with a cover image and clean,
 * authoritative metadata. Used to visually confirm a cover photo when text
 * extraction alone is uncertain. Issues a single API request to stay within
 * Discogs rate limits even when matching large photo batches.
 */
export async function searchDiscogsCandidates(
  artist: string,
  title: string,
  catalogNumber: string | undefined,
  token: DiscogsAuthInput,
  limit = 4
): Promise<DiscogsReleaseCandidate[]> {
  const params = new URLSearchParams({ type: "release", per_page: "10" });
  if (artist) params.set("artist", artist);
  if (title) params.set("release_title", title);
  if (catalogNumber) params.set("catno", catalogNumber);

  let results: SearchResult[];
  try {
    const data = await discogsFetch<DiscogsSearchResult>(
      `/database/search?${params.toString()}`,
      token
    );
    results = data.results ?? [];
  } catch (err) {
    logDiscogs("warn", "candidate_search_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  // Prefer vinyl pressings, then the most-collected releases.
  const ranked = results.slice().sort((a, b) => {
    const aVinyl = a.format?.some((f) => /vinyl|lp/i.test(f)) ? 1 : 0;
    const bVinyl = b.format?.some((f) => /vinyl|lp/i.test(f)) ? 1 : 0;
    if (aVinyl !== bVinyl) return bVinyl - aVinyl;
    return (b.community?.have ?? 0) - (a.community?.have ?? 0);
  });

  const out: DiscogsReleaseCandidate[] = [];
  const seen = new Set<number>();
  for (const r of ranked) {
    if (out.length >= limit) break;
    if (!r.id || seen.has(r.id)) continue;
    seen.add(r.id);
    const { artist: a, title: t } = splitArtistTitle(r.title ?? "");
    if (!t) continue;
    out.push({
      id: r.id,
      artist: a,
      title: t,
      catalogNumber: r.catno,
      coverImage: r.cover_image ?? r.thumb,
      year: r.year != null ? String(r.year) : undefined,
    });
  }
  return out;
}

export async function fetchMarketplaceStats(
  releaseId: number,
  token: DiscogsAuthInput
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
  token: DiscogsAuthInput
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
  token: DiscogsAuthInput
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
  auth: DiscogsAuthInput
): Promise<T> {
  await rateLimit();
  const res = await fetch(`${DISCOGS_BASE}${path}`, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Authorization: buildDiscogsAuthHeader(auth),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) throw await discogsErrorFromResponse(res, "POST", path);
  return res.json() as Promise<T>;
}

async function discogsDelete(path: string, auth: DiscogsAuthInput): Promise<void> {
  await rateLimit();
  const res = await fetch(`${DISCOGS_BASE}${path}`, {
    method: "DELETE",
    headers: {
      "User-Agent": USER_AGENT,
      Authorization: buildDiscogsAuthHeader(auth),
    },
    cache: "no-store",
  });

  if (res.status === 404) return; // already gone
  if (!res.ok) throw await discogsErrorFromResponse(res, "DELETE", path);
}

export async function createDiscogsListing(params: {
  releaseId: number;
  condition: AlbumCondition;
  price: number;
  token: DiscogsAuthInput;
  comments?: string;
}): Promise<{ listingId: number; listingUrl: string }> {
  const grade = CONDITION_TO_DISCOGS_GRADE[params.condition];

  // Validate before hitting the API so we fail with a clear reason rather than
  // a generic Discogs 422.
  if (!grade) {
    throw new DiscogsError(
      400,
      `Unknown album condition "${params.condition}" — cannot map to a Discogs grade.`
    );
  }
  if (!Number.isFinite(params.releaseId) || params.releaseId <= 0) {
    throw new DiscogsError(
      400,
      "Missing a valid Discogs release ID. Fetch prices first to match the release."
    );
  }
  const price = Math.round(params.price * 100) / 100;
  if (!Number.isFinite(price) || price <= 0) {
    throw new DiscogsError(400, "List price must be a positive number.");
  }

  // `weight`/`format_quantity: "auto"` let Discogs compute shipping so the
  // listing can go live as "For Sale"; "Mint (M)" sleeve falls back per grade.
  const requestBody = {
    release_id: params.releaseId,
    condition: grade,
    sleeve_condition: grade,
    price,
    status: "For Sale",
    allow_offers: false,
    weight: "auto",
    format_quantity: "auto",
    comments: params.comments ?? "Ships from USA. Securely packed.",
  };

  logDiscogs("info", "create_listing_request", {
    releaseId: params.releaseId,
    condition: grade,
    price,
  });

  const data = await discogsPost<{ listing_id: number; resource_url: string }>(
    "/marketplace/listings",
    requestBody,
    params.token
  );

  if (!data?.listing_id) {
    logDiscogs("error", "create_listing_no_id", { response: data });
    throw new DiscogsError(
      502,
      "Discogs accepted the request but returned no listing ID."
    );
  }

  logDiscogs("info", "create_listing_success", {
    listingId: data.listing_id,
    releaseId: params.releaseId,
  });

  return {
    listingId: data.listing_id,
    listingUrl: `https://www.discogs.com/sell/item/${data.listing_id}`,
  };
}

export async function deleteDiscogsListing(
  listingId: number,
  token: DiscogsAuthInput
): Promise<void> {
  await discogsDelete(`/marketplace/listings/${listingId}`, token);
}

export async function getDiscogsListingStatus(
  listingId: number,
  token: DiscogsAuthInput
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

export type DiscogsListingState =
  | "active"
  | "sold"
  | "inactive"
  | "not_found";

/** Whether a Discogs listing is still live on the marketplace. */
export async function getDiscogsListingState(
  listingId: number,
  token: DiscogsAuthInput
): Promise<{ state: DiscogsListingState; price?: number }> {
  const data = await getDiscogsListingStatus(listingId, token);
  if (!data) return { state: "not_found" };
  if (data.status === "Sold") return { state: "sold", price: data.price };
  if (data.status === "For Sale") return { state: "active", price: data.price };
  // Draft, Expired, Suspended, etc.
  return { state: "inactive" };
}

// ============================================================================
// Discogs Marketplace — order lookup for buyer address
// ============================================================================

interface DiscogsOrderItem {
  id: number;
}

interface DiscogsOrder {
  id: string;
  status: string;
  shipping_address: string;
  buyer: { username: string };
  items: DiscogsOrderItem[];
}

interface DiscogsOrdersResponse {
  orders: DiscogsOrder[];
  pagination: { pages: number; page: number };
}

export async function getDiscogsOrderForListing(
  listingId: number,
  token: DiscogsAuthInput
): Promise<{ orderId: string; shippingAddress: string; buyerName: string } | null> {
  // Check the first 3 pages of recent orders (newest first)
  for (let page = 1; page <= 3; page++) {
    let data: DiscogsOrdersResponse;
    try {
      data = await discogsFetch<DiscogsOrdersResponse>(
        `/marketplace/orders?per_page=50&page=${page}&sort=last_activity&sort_order=desc`,
        token
      );
    } catch {
      return null;
    }

    const match = (data.orders ?? []).find((order) =>
      order.items?.some((item) => item.id === listingId)
    );

    if (match) {
      return {
        orderId: match.id,
        shippingAddress: match.shipping_address ?? "",
        buyerName: match.buyer?.username ?? "",
      };
    }

    if (page >= (data.pagination?.pages ?? 1)) break;
  }

  return null;
}

export interface ParsedAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

/**
 * Best-effort parser for Discogs's free-text shipping_address field.
 * Common formats (newline-delimited):
 *   "Name\nStreet\nCity, ST ZIP\nCountry"
 *   "Name\nStreet\nCity ST ZIP\nCountry"
 *   "Name\nStreet\nApt\nCity, ST ZIP\nCountry"
 */
export function parseDiscogsShippingAddress(
  raw: string,
  buyerUsername: string
): ParsedAddress | null {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 3) return null;

  const name = lines[0] || buyerUsername;
  const country = lines[lines.length - 1];

  // City/State/ZIP line is second-to-last
  const cityStateZipLine = lines[lines.length - 2];
  // Try "City, ST 12345" or "City ST 12345"
  const usMatch = cityStateZipLine.match(
    /^(.+?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/
  );

  let city = "";
  let state = "";
  let zip = "";

  if (usMatch) {
    city = usMatch[1].trim();
    state = usMatch[2];
    zip = usMatch[3];
  } else {
    // International: "City PostalCode" or just "City"
    const intlMatch = cityStateZipLine.match(/^(.+?)\s+([\w\d\s-]{3,10})$/);
    if (intlMatch) {
      city = intlMatch[1].trim();
      zip = intlMatch[2].trim();
    } else {
      city = cityStateZipLine;
    }
  }

  // Street lines are everything between name and city/state/zip
  const streetLines = lines.slice(1, lines.length - 2);
  const street1 = streetLines[0] ?? "";
  const street2 = streetLines[1];

  if (!name || !street1 || !city) return null;

  return { name, street1, street2, city, state, zip, country };
}

export async function testDiscogsConnection(
  token: DiscogsAuthInput
): Promise<boolean> {
  try {
    await discogsFetch<{ id: number }>(`/oauth/identity`, token);
    return true;
  } catch {
    return false;
  }
}
