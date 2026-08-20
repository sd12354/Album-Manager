export function resolveListingPrice(input: {
  requestedPrice?: number | null;
  listPrice?: number | null;
  suggestedPrice?: number | null;
}) {
  const rawPrice =
    input.requestedPrice ?? input.listPrice ?? input.suggestedPrice ?? null;
  const price = Number(rawPrice);

  return Number.isFinite(price) && price > 0 ? price : null;
}

export function isLocalMarketplaceListingId(listingId: string | null | undefined) {
  return Boolean(
    listingId &&
      (listingId.startsWith("manual-") || listingId.startsWith("STUB-"))
  );
}
