export function isLocalMarketplaceListingId(id: string | null | undefined): boolean {
  return id?.startsWith("manual-") === true || id?.startsWith("STUB-") === true;
}

export function resolveListingPrice(
  requestedPrice: number | null | undefined,
  albumListPrice: number | null | undefined,
  albumSuggestedPrice: number | null | undefined
): number | null {
  const candidates = [requestedPrice, albumListPrice, albumSuggestedPrice];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    const price = Number(candidate);
    return Number.isFinite(price) && price > 0 ? price : null;
  }

  return null;
}
