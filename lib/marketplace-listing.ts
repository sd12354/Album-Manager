export function resolveListingPrice(
  requestedPrice: number | null | undefined,
  listPrice: number | null | undefined,
  suggestedPrice: number | null | undefined
): number | null {
  const candidates =
    requestedPrice != null ? [requestedPrice] : [listPrice, suggestedPrice];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    const price = Number(candidate);
    if (Number.isFinite(price) && price > 0) return price;
  }

  return null;
}

export function isLocalMarketplaceListingId(
  listingId: string | null | undefined
): boolean {
  return Boolean(
    listingId &&
      (listingId.startsWith("manual-") || listingId.startsWith("STUB-"))
  );
}
