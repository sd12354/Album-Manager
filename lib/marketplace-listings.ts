import type { Album } from "@/types";

export function resolveListingPrice(
  requestedPrice: number | null | undefined,
  album: Pick<Album, "list_price" | "suggested_price">
) {
  const rawPrice = requestedPrice ?? album.list_price ?? album.suggested_price;
  const price = Number(rawPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function isLocalMarketplaceListingId(
  listingId: string | null | undefined
) {
  return (
    typeof listingId === "string" &&
    (listingId.startsWith("manual-") || listingId.startsWith("STUB-"))
  );
}
