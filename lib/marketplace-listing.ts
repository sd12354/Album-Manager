import type { Album } from "@/types";

export function isLocalMarketplaceListingId(listingId: string | null | undefined) {
  return Boolean(
    listingId?.startsWith("manual-") || listingId?.startsWith("STUB-")
  );
}

export function resolveListingPrice(
  album: Pick<Album, "list_price" | "suggested_price">,
  requestedPrice?: number | null
) {
  const rawPrice = requestedPrice ?? album.list_price ?? album.suggested_price;
  const price = Number(rawPrice);

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return price;
}
