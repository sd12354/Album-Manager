import type { Album } from "@/types";

export function resolveListingPrice(
  requestedPrice: number | null | undefined,
  album: Pick<Album, "list_price" | "suggested_price">
) {
  const rawPrice =
    requestedPrice ?? album.list_price ?? album.suggested_price ?? null;
  const price = Number(rawPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}
