import type { Album } from "@/types";

const LOCAL_LISTING_PREFIXES = ["manual-", "STUB-"] as const;

export function isLocalMarketplaceListingId(
  listingId: string | null | undefined
): boolean {
  return Boolean(
    listingId &&
      LOCAL_LISTING_PREFIXES.some((prefix) => listingId.startsWith(prefix))
  );
}

export function resolveListingPrice(
  album: Pick<Album, "list_price" | "suggested_price">,
  requestedPrice?: number | null
): number | null {
  const rawPrice = requestedPrice ?? album.list_price ?? album.suggested_price;
  const price = Number(rawPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}
