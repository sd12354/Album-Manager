import type { Album } from "@/types";

type ListingPriceAlbum = Pick<Album, "list_price" | "suggested_price">;

export function resolveListingPrice(
  requestedPrice: number | null | undefined,
  album: ListingPriceAlbum
): number | null {
  const rawPrice =
    requestedPrice ?? album.list_price ?? album.suggested_price ?? null;
  const price = Number(rawPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function isLocalMarketplaceListingId(
  listingId: string | null | undefined
): boolean {
  return Boolean(
    listingId &&
      (listingId.startsWith("manual-") || listingId.startsWith("STUB-"))
  );
}
