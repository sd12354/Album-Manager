export const EBAY_ENVIRONMENT = process.env.EBAY_ENVIRONMENT ?? "sandbox";

export const EBAY_AUTH_URL =
  EBAY_ENVIRONMENT === "production"
    ? "https://auth.ebay.com/oauth2/authorize"
    : "https://auth.sandbox.ebay.com/oauth2/authorize";

export const EBAY_TOKEN_URL =
  EBAY_ENVIRONMENT === "production"
    ? "https://api.ebay.com/identity/v1/oauth2/token"
    : "https://api.sandbox.ebay.com/identity/v1/oauth2/token";

export const EBAY_BROWSE_URL =
  EBAY_ENVIRONMENT === "production"
    ? "https://api.ebay.com/buy/browse/v1"
    : "https://api.sandbox.ebay.com/buy/browse/v1";

export const EBAY_TRADING_URL =
  EBAY_ENVIRONMENT === "production"
    ? "https://api.ebay.com/ws/api.dll"
    : "https://api.sandbox.ebay.com/ws/api.dll";

export const GENRE_TO_CATEGORY: Record<string, number> = {
  Jazz: 309,
  Rock: 176985,
  Pop: 176985,
  "R&B": 176984,
  "R&B/Soul": 176984,
  Soul: 176984,
  Classical: 3346,
  Electronic: 176984,
  Folk: 176985,
  Country: 176985,
  Blues: 176984,
  HipHop: 176984,
  "Hip-Hop": 176984,
  Reggae: 176984,
  Punk: 176985,
  Metal: 176985,
  Soundtrack: 176984,
  "World Music": 176984,
};

export const CONDITION_TO_EBAY: Record<string, number> = {
  Mint: 1000,
  Great: 3000,
  Good: 4000,
  Fair: 5000,
  Poor: 6000,
};

export function getCategoryForGenre(genre?: string | null): number {
  if (!genre) return 176985;
  return GENRE_TO_CATEGORY[genre] ?? 176985;
}

export function buildListingTitle(
  artist: string,
  title: string,
  condition: string
): string {
  return `${artist} - ${title} Vinyl Record LP ${condition}`;
}

export function buildListingDescription(
  artist: string,
  title: string,
  condition: string,
  genre?: string | null,
  catalogNumber?: string | null
): string {
  return `# ${artist} - ${title}

**Condition:** ${condition}
${genre ? `**Genre:** ${genre}` : ""}
${catalogNumber ? `**Catalog #:** ${catalogNumber}` : ""}

Vintage vinyl record in ${condition.toLowerCase()} condition. Ships securely with protective packaging.

---
Listed via VinylVault`;
}

export function getSandboxListingUrl(listingId: string): string {
  return EBAY_ENVIRONMENT === "production"
    ? `https://www.ebay.com/itm/${listingId}`
    : `https://sandbox.ebay.com/itm/${listingId}`;
}

// TODO: Implement real token refresh with encryption
export async function getValidEbayToken(
  _userId: string
): Promise<string | null> {
  return null;
}

// ============================================================================
// eBay Application Token (client_credentials grant) — used for the Browse API
// to fetch pricing comparables. Distinct from per-user OAuth tokens used for
// listing items. Tokens last 2h; we cache and refresh ~5 min before expiry.
// ============================================================================

interface CachedAppToken {
  token: string;
  expiresAt: number;
}

let cachedAppToken: CachedAppToken | null = null;
let inflightTokenPromise: Promise<string> | null = null;

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

async function fetchEbayAppToken(): Promise<string> {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "eBay credentials missing. Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in .env.local."
    );
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }).toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `eBay token request failed (${res.status}): ${body.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  cachedAppToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - TOKEN_REFRESH_BUFFER_MS,
  };
  return data.access_token;
}

export async function getEbayAppToken(): Promise<string> {
  if (cachedAppToken && cachedAppToken.expiresAt > Date.now()) {
    return cachedAppToken.token;
  }
  if (inflightTokenPromise) return inflightTokenPromise;
  inflightTokenPromise = fetchEbayAppToken().finally(() => {
    inflightTokenPromise = null;
  });
  return inflightTokenPromise;
}

// ============================================================================
// eBay Browse API — search active listings for pricing comparables
// ============================================================================

interface EbayItemSummary {
  itemId: string;
  title?: string;
  price?: { value: string; currency: string };
  condition?: string;
  itemWebUrl?: string;
  buyingOptions?: string[];
}

interface EbayBrowseResponse {
  itemSummaries?: EbayItemSummary[];
  total?: number;
  warnings?: Array<{ message?: string }>;
}

export interface EbayPriceResult {
  median?: number;
  lowest?: number;
  highest?: number;
  count: number;
  /** Up to 5 sorted comparables for the UI. */
  comparables: number[];
  /** Sample listing URLs for "view comparables" links. */
  sampleListings: Array<{ price: number; title: string; url: string }>;
  error?: string;
}

/**
 * Median of a numeric array (assumes already sorted ascending — or sorts).
 */
function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Drop outliers >5× or <0.2× the median. Common on eBay: shipping-only
 * listings priced at $999 or sketchy $0.99 incomplete copies.
 */
function filterOutliers(prices: number[]): number[] {
  if (prices.length < 4) return prices;
  const m = median(prices)!;
  return prices.filter((p) => p >= m * 0.2 && p <= m * 5);
}

/**
 * Search eBay Browse API for active vinyl listings. Returns aggregate price
 * stats useful as pricing comparables. Requires sandbox or production app
 * credentials — sandbox returns very few/no real results.
 */
export async function searchEbayActiveListings(
  artist: string,
  title: string,
  options: {
    genre?: string | null;
    limit?: number;
  } = {}
): Promise<EbayPriceResult> {
  const limit = options.limit ?? 25;
  const categoryId = getCategoryForGenre(options.genre);

  let token: string;
  try {
    token = await getEbayAppToken();
  } catch (err) {
    return {
      count: 0,
      comparables: [],
      sampleListings: [],
      error: err instanceof Error ? err.message : "Failed to get eBay token",
    };
  }

  const query = `${artist} ${title} vinyl`.replace(/\s+/g, " ").trim();
  const params = new URLSearchParams({
    q: query,
    category_ids: String(categoryId),
    limit: String(limit),
    filter: "buyingOptions:{FIXED_PRICE}",
  });

  const res = await fetch(`${EBAY_BROWSE_URL}/item_summary/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      count: 0,
      comparables: [],
      sampleListings: [],
      error: `eBay Browse API ${res.status}: ${body.slice(0, 200)}`,
    };
  }

  const data = (await res.json()) as EbayBrowseResponse;
  const items = data.itemSummaries ?? [];

  // Filter items: must have a USD price, must mention vinyl/LP/album/record in
  // title (cuts out merch, posters, framed art, etc.).
  const vinylKeyword = /\b(vinyl|lp|album|record|33\s?(?:1\/3|rpm)|45\s?rpm)\b/i;
  const validItems = items.filter((item) => {
    if (!item.price?.value) return false;
    if (item.price.currency !== "USD") return false;
    if (!item.title) return false;
    return vinylKeyword.test(item.title);
  });

  const rawPrices = validItems
    .map((item) => parseFloat(item.price!.value))
    .filter((p) => p > 0 && Number.isFinite(p));

  if (rawPrices.length === 0) {
    return {
      count: 0,
      comparables: [],
      sampleListings: [],
      error:
        items.length > 0
          ? "eBay returned listings but none looked like vinyl pressings."
          : `No eBay vinyl listings found for "${query}".`,
    };
  }

  const cleaned = filterOutliers(rawPrices).sort((a, b) => a - b);
  const med = median(cleaned);

  const sampleListings = validItems
    .filter((item) => {
      const p = parseFloat(item.price!.value);
      return cleaned.includes(p);
    })
    .slice(0, 5)
    .map((item) => ({
      price: Math.round(parseFloat(item.price!.value) * 100) / 100,
      title: item.title ?? "",
      url: item.itemWebUrl ?? "",
    }));

  return {
    median: med != null ? Math.round(med * 100) / 100 : undefined,
    lowest:
      cleaned[0] != null ? Math.round(cleaned[0] * 100) / 100 : undefined,
    highest:
      cleaned[cleaned.length - 1] != null
        ? Math.round(cleaned[cleaned.length - 1] * 100) / 100
        : undefined,
    count: cleaned.length,
    comparables: cleaned.slice(0, 10).map((p) => Math.round(p * 100) / 100),
    sampleListings,
  };
}
