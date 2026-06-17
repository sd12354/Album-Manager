import type { Album, PricingCache } from "@/types";

export interface AlbumValueBounds {
  estimate: number;
  low: number;
  high: number;
  /** True when low/high came from marketplace cache, not a heuristic band. */
  fromMarketData: boolean;
}

export interface CollectionValueSummary {
  estimatedTotal: number;
  lowTotal: number;
  highTotal: number;
  pricedCount: number;
  unpricedCount: number;
  marketDataCount: number;
}

type CacheByAlbum = Map<
  string,
  { discogs?: PricingCache; ebay?: PricingCache }
>;

function groupPricingCache(rows: PricingCache[]): CacheByAlbum {
  const map: CacheByAlbum = new Map();
  for (const row of rows) {
    const entry = map.get(row.album_id) ?? {};
    if (row.source === "discogs") entry.discogs = row;
    if (row.source === "ebay") entry.ebay = row;
    map.set(row.album_id, entry);
  }
  return map;
}

/** Per-album estimate plus a conservative low / optimistic high. */
export function getAlbumValueBounds(
  album: Album,
  cacheByAlbum: CacheByAlbum
): AlbumValueBounds | null {
  const estimate = album.list_price ?? album.suggested_price;
  if (estimate == null || estimate <= 0) return null;

  const cache = cacheByAlbum.get(album.id);
  const discogs = cache?.discogs;
  const ebay = cache?.ebay;

  const marketLows: number[] = [];
  const marketHighs: number[] = [];

  if (discogs?.lowest_price != null && discogs.lowest_price > 0) {
    marketLows.push(discogs.lowest_price);
  }
  if (ebay?.lowest_price != null && ebay.lowest_price > 0) {
    marketLows.push(ebay.lowest_price);
  }

  if (discogs?.median_price != null && discogs.median_price > 0) {
    marketHighs.push(discogs.median_price);
  }
  if (ebay?.median_price != null && ebay.median_price > 0) {
    marketHighs.push(ebay.median_price);
  }

  const ebayHighest = (ebay?.raw_data as { highest?: number } | undefined)
    ?.highest;
  if (ebayHighest != null && ebayHighest > 0) {
    marketHighs.push(ebayHighest);
  }

  const fromMarketData = marketLows.length > 0 || marketHighs.length > 0;

  let low =
    marketLows.length > 0
      ? Math.min(...marketLows)
      : Math.round(estimate * 0.8 * 100) / 100;
  let high =
    marketHighs.length > 0
      ? Math.max(...marketHighs)
      : Math.round(estimate * 1.25 * 100) / 100;

  // Keep the band anchored on the estimate we actually show in the catalogue.
  low = Math.min(low, estimate);
  high = Math.max(high, estimate);

  return { estimate, low, high, fromMarketData };
}

export function summarizeCollectionValue(
  albums: Album[],
  cacheRows: PricingCache[]
): CollectionValueSummary {
  const unsold = albums.filter((a) => a.status !== "sold");
  const cacheByAlbum = groupPricingCache(cacheRows);

  let estimatedTotal = 0;
  let lowTotal = 0;
  let highTotal = 0;
  let pricedCount = 0;
  let unpricedCount = 0;
  let marketDataCount = 0;

  for (const album of unsold) {
    const bounds = getAlbumValueBounds(album, cacheByAlbum);
    if (!bounds) {
      unpricedCount++;
      continue;
    }
    pricedCount++;
    estimatedTotal += bounds.estimate;
    lowTotal += bounds.low;
    highTotal += bounds.high;
    if (bounds.fromMarketData) marketDataCount++;
  }

  return {
    estimatedTotal: Math.round(estimatedTotal * 100) / 100,
    lowTotal: Math.round(lowTotal * 100) / 100,
    highTotal: Math.round(highTotal * 100) / 100,
    pricedCount,
    unpricedCount,
    marketDataCount,
  };
}
