export function resolveListingPrice(
  requestedPrice: number | null | undefined,
  listPrice: number | null | undefined,
  suggestedPrice: number | null | undefined
): number | null {
  const rawPrice = requestedPrice ?? listPrice ?? suggestedPrice;
  const price = Number(rawPrice);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function isLocalMarketplaceListingId(id: string | null | undefined): boolean {
  return id?.startsWith("manual-") === true || id?.startsWith("STUB-") === true;
}
