import type { Album } from "@/types";

export function isLocalMarketplaceListingId(
  listingId: string | null | undefined
): boolean {
  return Boolean(
    listingId?.startsWith("manual-") || listingId?.startsWith("STUB-")
  );
}

export function resolveListingPrice(
  listPrice: number | null | undefined,
  album: Pick<Album, "list_price" | "suggested_price">
): number | null {
  const rawPrice = listPrice ?? album.list_price ?? album.suggested_price;
  const price = Number(rawPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}

