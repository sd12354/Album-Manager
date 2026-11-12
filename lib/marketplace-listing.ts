export function resolveListingPrice(
  requestedPrice: number | null | undefined,
  listPrice: number | null | undefined,
  suggestedPrice: number | null | undefined
): number | null {
  const rawPrice = requestedPrice ?? listPrice ?? suggestedPrice;
  const price = Number(rawPrice);

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return price;
}

export function isLocalMarketplaceListingId(
  listingId: string | null | undefined
): boolean {
  return Boolean(
    listingId?.startsWith("manual-") || listingId?.startsWith("STUB-")
  );
}
