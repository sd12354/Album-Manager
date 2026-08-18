export function isLocalMarketplaceListingId(
  listingId: string | null | undefined
): boolean {
  return (
    listingId?.startsWith("manual-") === true ||
    listingId?.startsWith("STUB-") === true
  );
}

export function resolveMarketplaceListPrice({
  requestedPrice,
  savedListPrice,
  suggestedPrice,
}: {
  requestedPrice?: number | null;
  savedListPrice?: number | null;
  suggestedPrice?: number | null;
}): number | null {
  const rawPrice = requestedPrice ?? savedListPrice ?? suggestedPrice;
  const price = Number(rawPrice);

  return Number.isFinite(price) && price > 0 ? price : null;
}
