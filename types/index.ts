export type AlbumStatus = "unlisted" | "pricing" | "listed" | "sold";

export type AlbumCondition = "Mint" | "Great" | "Good" | "Fair" | "Poor";

export interface Album {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  genre?: string | null;
  condition: AlbumCondition;
  catalog_number?: string | null;
  notes?: string | null;
  purchase_price?: number | null;
  suggested_price?: number | null;
  list_price?: number | null;
  status: AlbumStatus;
  ebay_listing_id?: string | null;
  ebay_listing_url?: string | null;
  sold_price?: number | null;
  sold_at?: string | null;
  photo_urls?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface PricingResult {
  discogsMedian?: number;
  discogsLowest?: number;
  discogsSalesCount?: number;
  discogsReleaseId?: number;
  discogsReleaseTitle?: string;
  discogsReleaseYear?: string;
  /** Discogs's own price suggestion for our specific condition grade. */
  discogsPriceForCondition?: number;
  /** Full grade → price map from Discogs price_suggestions. */
  discogsConditionPrices?: Record<string, number>;
  ebayMedian?: number;
  ebayLowest?: number;
  ebayHighest?: number;
  ebayComparables?: number[];
  ebayCount?: number;
  ebaySampleListings?: Array<{ price: number; title: string; url: string }>;
  suggestedPrice: number;
  confidence: "low" | "medium" | "high";
  /** Which source produced the final suggestedPrice. */
  suggestionSource?: "discogs-condition" | "discogs-median" | "ebay-active";
  /** Optional non-fatal warning (e.g. "no Discogs release found"). */
  notice?: string;
}

export interface PricingCache {
  id: string;
  album_id: string;
  source: "discogs" | "ebay";
  median_price?: number | null;
  lowest_price?: number | null;
  num_sales?: number | null;
  raw_data?: Record<string, unknown> | null;
  fetched_at: string;
}

export interface EbayCredentials {
  user_id: string;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expiry?: string | null;
  updated_at: string;
}

export interface CSVAlbumRow {
  title: string;
  artist: string;
  genre?: string;
  condition: AlbumCondition;
  catalog_number?: string;
  notes?: string;
  purchase_price?: number;
}

export interface UserSettings {
  discogs_token?: string;
  minimum_floor_price?: number;
  condition_multipliers?: Partial<Record<AlbumCondition, number>>;
  email_on_sale?: boolean;
  shipping_profile?: string;
  ebay_username?: string;
  ebay_environment?: "production" | "sandbox" | "stub";
}
