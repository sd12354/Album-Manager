export function isLocalMarketplaceListingId(id: string | null | undefined) {
  return Boolean(id?.startsWith("manual-") || id?.startsWith("STUB-"));
}

export function resolveListingPrice(
  requestedPrice: number | null | undefined,
  listPrice: number | null | undefined,
  suggestedPrice: number | null | undefined
) {
  const price = requestedPrice ?? listPrice ?? suggestedPrice;
  return typeof price === "number" && Number.isFinite(price) && price > 0
    ? price
    : null;
}
