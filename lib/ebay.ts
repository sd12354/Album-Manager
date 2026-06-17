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

// Identity API uses the apiz.* subdomain (not api.*) — easy to miss.
export const EBAY_IDENTITY_URL =
  EBAY_ENVIRONMENT === "production"
    ? "https://apiz.ebay.com/commerce/identity/v1/user/"
    : "https://apiz.sandbox.ebay.com/commerce/identity/v1/user/";

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

/** eBay Records category only accepts New (1000) or Used (3000). */
export const CONDITION_TO_EBAY: Record<string, number> = {
  Mint: 1000,
  Great: 3000,
  Good: 3000,
  Fair: 3000,
  Poor: 3000,
};

/** Goldmine grades for Record Grading / Sleeve Grading item specifics. */
export const CONDITION_TO_GOLDMINE: Record<string, string> = {
  Mint: "Mint (M)",
  Great: "Near Mint (NM or M-)",
  Good: "Very Good Plus (VG+)",
  Fair: "Good (G)",
  Poor: "Poor (P)",
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

// ============================================================================
// User OAuth token management — refresh when near expiry
// ============================================================================

export interface EbayTokenCredentials {
  access_token: string;
  refresh_token: string;
  token_expiry: string;
}

/**
 * Whether stored credentials represent a real, usable eBay connection.
 * Relies on the persisted token rather than the user_metadata
 * `ebay_environment` flag, which can be stale or missing even after a
 * successful production connect.
 */
export function hasRealEbayCredentials(
  creds?: { access_token?: string | null } | null
): boolean {
  return Boolean(
    process.env.EBAY_CLIENT_ID &&
      creds?.access_token &&
      creds.access_token !== "stub-access-token"
  );
}

export async function refreshEbayToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const ruName = process.env.EBAY_RU_NAME;
  if (!clientId || !clientSecret || !ruName) return null;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: [
        "https://api.ebay.com/oauth/api_scope",
        "https://api.ebay.com/oauth/api_scope/sell.inventory",
      ].join(" "),
    }).toString(),
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return data;
}

export async function getValidEbayToken(
  credentials: EbayTokenCredentials
): Promise<{ token: string; refreshed: false } | { token: string; refreshed: true; expiry: string }> {
  const expiresAt = new Date(credentials.token_expiry).getTime();
  const bufferMs = 5 * 60 * 1000;
  if (Date.now() + bufferMs < expiresAt) {
    return { token: credentials.access_token, refreshed: false };
  }
  const refreshed = await refreshEbayToken(credentials.refresh_token);
  if (!refreshed) {
    throw new Error("eBay authorization expired. Reconnect your eBay account in Settings.");
  }
  const expiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  return { token: refreshed.access_token, refreshed: true, expiry };
}

// ============================================================================
// eBay Trading API — XML helper
// ============================================================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Neutralize any `]]>` so a description can't prematurely close its CDATA. */
function escapeCdata(str: string): string {
  return str.replace(/\]\]>/g, "]]]]><![CDATA[>");
}

function extractXmlTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m?.[1]?.trim();
}

function extractXmlError(xml: string): string | null {
  const severity = extractXmlTag(xml, "SeverityCode");
  if (severity === "Error") {
    return (
      extractXmlTag(xml, "LongMessage") ??
      extractXmlTag(xml, "ShortMessage") ??
      "Unknown eBay error"
    );
  }
  return null;
}

async function callTradingApi(
  callName: string,
  xmlBody: string,
  accessToken: string
): Promise<string> {
  const res = await fetch(EBAY_TRADING_URL, {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID": "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-CALL-NAME": callName,
      "X-EBAY-API-IAF-TOKEN": accessToken,
      "Content-Type": "text/xml",
    },
    body: xmlBody,
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`eBay Trading API HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return text;
}

// ============================================================================
// eBay Trading API — create / end listings
// ============================================================================

import type { Album } from "@/types";
import { EBAY_MAX_PHOTOS, getOriginalPublicUrl } from "@/lib/photos";

export interface SellerLocation {
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export async function createEbayListing(
  album: Album,
  price: number,
  accessToken: string,
  sellerLocation?: SellerLocation,
  descriptionOverride?: string
): Promise<{ itemId: string; listingUrl: string }> {
  const pictureUrlsXml = (album.photo_urls ?? [])
    .slice(0, EBAY_MAX_PHOTOS)
    .map((u) => `<PictureURL>${escapeXml(getOriginalPublicUrl(u))}</PictureURL>`)
    .join("");

  const goldmineGrade =
    CONDITION_TO_GOLDMINE[album.condition] ?? "Very Good Plus (VG+)";

  // eBay music categories require Artist as a mandatory item specific.
  // Without it the API returns "The item specific Artist is missing."
  // ConditionID is New/Used only; true grade goes in Record/Sleeve Grading.
  const itemSpecificsXml = [
    `<NameValueList><Name>Artist</Name><Value>${escapeXml(album.artist)}</Value></NameValueList>`,
    `<NameValueList><Name>Album Title</Name><Value>${escapeXml(album.title)}</Value></NameValueList>`,
    "<NameValueList><Name>Format</Name><Value>Vinyl</Value></NameValueList>",
    "<NameValueList><Name>Type</Name><Value>LP</Value></NameValueList>",
    `<NameValueList><Name>Record Grading</Name><Value>${escapeXml(goldmineGrade)}</Value></NameValueList>`,
    `<NameValueList><Name>Sleeve Grading</Name><Value>${escapeXml(goldmineGrade)}</Value></NameValueList>`,
    album.genre
      ? `<NameValueList><Name>Genre</Name><Value>${escapeXml(album.genre)}</Value></NameValueList>`
      : "",
    album.catalog_number
      ? `<NameValueList><Name>Catalog Number</Name><Value>${escapeXml(album.catalog_number)}</Value></NameValueList>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const categoryId = getCategoryForGenre(album.genre);
  const conditionId = CONDITION_TO_EBAY[album.condition] ?? 3000;
  const country = sellerLocation?.country || "US";

  // Build location string: "City, ST" or just "US" as a fallback.
  // eBay requires <Location> — without it the API returns
  // "Your item's location was not filled in."
  const locationParts = [sellerLocation?.city, sellerLocation?.state].filter(Boolean);
  const locationStr = locationParts.length > 0 ? locationParts.join(", ") : country;
  const postalCode = sellerLocation?.zip || "";

  const description = escapeCdata(
    descriptionOverride ??
      buildListingDescription(
        album.artist,
        album.title,
        album.condition,
        album.genre,
        album.catalog_number
      )
  );

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <Item>
    <Title>${escapeXml(buildListingTitle(album.artist, album.title, album.condition))}</Title>
    <Description><![CDATA[${description}]]></Description>
    <PrimaryCategory><CategoryID>${categoryId}</CategoryID></PrimaryCategory>
    <StartPrice>${price.toFixed(2)}</StartPrice>
    <ConditionID>${conditionId}</ConditionID>
    <Country>${escapeXml(country)}</Country>
    <Currency>USD</Currency>
    <Location>${escapeXml(locationStr)}</Location>
    ${postalCode ? `<PostalCode>${escapeXml(postalCode)}</PostalCode>` : ""}
    <DispatchTimeMax>3</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <Quantity>1</Quantity>
    ${pictureUrlsXml ? `<PictureDetails>${pictureUrlsXml}</PictureDetails>` : ""}
    <ItemSpecifics>${itemSpecificsXml}</ItemSpecifics>
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>USPSMedia</ShippingService>
        <ShippingServiceCost>4.00</ShippingServiceCost>
      </ShippingServiceOptions>
    </ShippingDetails>
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <RefundOption>MoneyBack</RefundOption>
      <ReturnsWithinOption>Days_30</ReturnsWithinOption>
      <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
    </ReturnPolicy>
    <Site>US</Site>
  </Item>
</AddFixedPriceItemRequest>`;

  const responseXml = await callTradingApi("AddFixedPriceItem", xml, accessToken);

  const ebayError = extractXmlError(responseXml);
  if (ebayError) throw new Error(ebayError);

  const itemId = extractXmlTag(responseXml, "ItemID");
  if (!itemId) throw new Error("eBay did not return an ItemID");

  return {
    itemId,
    listingUrl: getSandboxListingUrl(itemId),
  };
}

export async function endEbayListing(
  itemId: string,
  accessToken: string
): Promise<void> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<EndFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>${escapeXml(itemId)}</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndFixedPriceItemRequest>`;

  const responseXml = await callTradingApi("EndFixedPriceItem", xml, accessToken);
  const ebayError = extractXmlError(responseXml);
  if (ebayError) throw new Error(ebayError);
}

export type EbayListingState =
  | { state: "active" }
  | { state: "sold"; price?: number }
  | { state: "ended" }
  | { state: "not_found" };

function isEbayItemMissingError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("not found") ||
    lower.includes("does not exist") ||
    lower.includes("invalid item") ||
    lower.includes("no longer available")
  );
}

/** Live eBay listing state from GetItem — sold, still active, ended, or gone. */
export async function getEbayListingState(
  itemId: string,
  accessToken: string
): Promise<EbayListingState> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>${escapeXml(itemId)}</ItemID>
  <IncludeItemSpecifics>false</IncludeItemSpecifics>
</GetItemRequest>`;

  const responseXml = await callTradingApi("GetItem", xml, accessToken);
  const ebayError = extractXmlError(responseXml);
  if (ebayError) {
    if (isEbayItemMissingError(ebayError)) return { state: "not_found" };
    throw new Error(ebayError);
  }

  const listingStatus = extractXmlTag(responseXml, "ListingStatus");
  const quantitySold = extractXmlTag(responseXml, "QuantitySold");
  const currentPrice = extractXmlTag(responseXml, "CurrentPrice");
  const soldQuantity = quantitySold != null ? parseInt(quantitySold, 10) : 0;

  if (Number.isFinite(soldQuantity) && soldQuantity > 0) {
    return {
      state: "sold",
      price: currentPrice ? parseFloat(currentPrice) : undefined,
    };
  }

  if (listingStatus === "Active") {
    return { state: "active" };
  }

  // Completed / Ended with zero quantity sold — delisted on eBay.
  return { state: "ended" };
}

export async function checkEbayItemSold(
  itemId: string,
  accessToken: string
): Promise<{ sold: boolean; price?: number }> {
  const result = await getEbayListingState(itemId, accessToken);
  if (result.state === "sold") {
    return { sold: true, price: result.price };
  }
  return { sold: false };
}

// ============================================================================
// eBay Trading API — fetch buyer address from a completed order
// ============================================================================

export interface EbayBuyerAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

function extractAllMatches(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

export async function getEbayOrderForItem(
  itemId: string,
  accessToken: string
): Promise<EbayBuyerAddress | null> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <NumberOfDays>30</NumberOfDays>
  <OrderRole>Seller</OrderRole>
  <OrderStatus>All</OrderStatus>
  <Detail>ReturnAll</Detail>
</GetOrdersRequest>`;

  let responseXml: string;
  try {
    responseXml = await callTradingApi("GetOrders", xml, accessToken);
  } catch {
    return null;
  }

  // Split into individual <Order> blocks and search for our ItemID.
  const orderBlocks: string[] = [];
  const orderRe = /<Order\b[\s\S]*?<\/Order>/g;
  let m;
  while ((m = orderRe.exec(responseXml)) !== null) {
    orderBlocks.push(m[0]);
  }

  for (const block of orderBlocks) {
    const itemIds = extractAllMatches(block, "ItemID");
    if (!itemIds.includes(itemId)) continue;

    // Found the order — extract ShippingAddress
    const shippingBlock = block.match(/<ShippingAddress[\s\S]*?<\/ShippingAddress>/)?.[0] ?? "";
    const name = extractXmlTag(shippingBlock, "Name");
    const street1 = extractXmlTag(shippingBlock, "Street1");
    const street2 = extractXmlTag(shippingBlock, "Street2");
    const city = extractXmlTag(shippingBlock, "CityName");
    const state = extractXmlTag(shippingBlock, "StateOrProvince");
    const zip = extractXmlTag(shippingBlock, "PostalCode");
    const country = extractXmlTag(shippingBlock, "Country");

    if (name && street1 && city && zip) {
      return {
        name,
        street1,
        street2: street2 || undefined,
        city,
        state: state ?? "",
        zip,
        country: country ?? "US",
      };
    }
  }

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
