export function isLocalMarketplaceListing(listingId: string | null | undefined) {
  return (
    listingId?.startsWith("manual-") === true ||
    listingId?.startsWith("STUB-") === true
  );
}
