interface ListingPriceInput {
  requestedPrice?: unknown;
  listPrice?: unknown;
  suggestedPrice?: unknown;
}

export function coercePositivePrice(value: unknown): number | null {
  if (value == null || value === "") return null;
  const price = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(price) || price <= 0) return null;
  return price;
}

export function resolveListingPrice({
  requestedPrice,
  listPrice,
  suggestedPrice,
}: ListingPriceInput): number | null {
  return (
    coercePositivePrice(requestedPrice) ??
    coercePositivePrice(listPrice) ??
    coercePositivePrice(suggestedPrice)
  );
}

export function isLocalMarketplaceListingId(id: string | null | undefined) {
  return Boolean(id?.startsWith("manual-") || id?.startsWith("STUB-"));
}
