export function isLocalMarketplaceListingId(id: string | null | undefined): boolean {
  return id?.startsWith("manual-") === true || id?.startsWith("STUB-") === true;
}

export function resolveMarketplaceListPrice(
  requestedPrice: number | null | undefined,
  savedListPrice: number | null | undefined,
  suggestedPrice: number | null | undefined
): number | null {
  const price = Number(requestedPrice ?? savedListPrice ?? suggestedPrice);
  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }
  return price;
}
