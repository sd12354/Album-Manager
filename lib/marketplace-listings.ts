export function isLocalMarketplaceListingId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith("manual-") || id?.startsWith("STUB-"));
}

export function resolveListingPrice(
  requestedPrice: number | null | undefined,
  listPrice: number | null | undefined,
  suggestedPrice: number | null | undefined
): number | null {
  for (const value of [requestedPrice, listPrice, suggestedPrice]) {
    if (typeof value !== "number") continue;
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

