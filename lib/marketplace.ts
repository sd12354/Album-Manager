import type { Album } from "@/types";

export function isLocalMarketplaceListingId(
  listingId: string | null | undefined
): boolean {
  return Boolean(
    listingId &&
      (listingId.startsWith("manual-") || listingId.startsWith("STUB-"))
  );
}

export function resolveListingPrice(
  requestedPrice: number | null | undefined,
  album: Pick<Album, "list_price" | "suggested_price">
): number | null {
  const candidates = [
    requestedPrice,
    album.list_price,
    album.suggested_price,
  ];

  for (const candidate of candidates) {
    const price = Number(candidate);
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
  }

  return null;
}
