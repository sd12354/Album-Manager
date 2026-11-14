import type { Album } from "@/types";

export function resolveListingPrice(
  album: Pick<Album, "list_price" | "suggested_price">,
  requestedPrice?: number | null
): number | null {
  const raw = requestedPrice ?? album.list_price ?? album.suggested_price;
  const price = Number(raw);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function isLocalMarketplaceListingId(
  listingId: string | null | undefined
): boolean {
  if (!listingId) return false;
  return listingId.startsWith("manual-") || listingId.startsWith("STUB-");
}
