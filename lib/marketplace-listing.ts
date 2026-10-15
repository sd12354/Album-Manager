import type { Album } from "@/types";

export function isLocalMarketplaceListingId(
  listingId: string | null | undefined
): boolean {
  return listingId?.startsWith("manual-") || listingId?.startsWith("STUB-") || false;
}

export function resolveListingPrice(
  requestedPrice: number | null | undefined,
  album: Pick<Album, "list_price" | "suggested_price">
): number | null {
  const rawPrice = requestedPrice ?? album.list_price ?? album.suggested_price;
  const price = Number(rawPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}
