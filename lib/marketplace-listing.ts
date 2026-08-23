import type { Album } from "@/types";

export function resolveMarketplaceListPrice(
  album: Pick<Album, "list_price" | "suggested_price">,
  requestedPrice?: number | null
): number | null {
  const rawPrice = requestedPrice ?? album.list_price ?? album.suggested_price;
  const price = Number(rawPrice);

  return Number.isFinite(price) && price > 0 ? price : null;
}

export function isLocalMarketplaceListingId(listingId?: string | null): boolean {
  return listingId?.startsWith("manual-") || listingId?.startsWith("STUB-") || false;
}
