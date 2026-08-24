export function resolveListingPrice(
  requestedPrice: number | null | undefined,
  listPrice: number | null | undefined,
  suggestedPrice: number | null | undefined
) {
  const rawPrice = requestedPrice ?? listPrice ?? suggestedPrice;
  const price = Number(rawPrice);

  return Number.isFinite(price) && price > 0 ? price : null;
}

export function isLocalMarketplaceListingId(
  listingId: string | null | undefined
) {
  return (
    listingId?.startsWith("manual-") ||
    listingId?.startsWith("STUB-") ||
    false
  );
}
