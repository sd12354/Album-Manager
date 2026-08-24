export function resolveListingPrice(
  requestedPrice: number | null | undefined,
  listPrice: number | null | undefined,
  suggestedPrice: number | null | undefined
) {
  const rawPrice = requestedPrice ?? listPrice ?? suggestedPrice;
  const price = Number(rawPrice);

  return Number.isFinite(price) && price > 0 ? price : null;
}
