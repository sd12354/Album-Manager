export function isLocalMarketplaceListingId(id: string | null | undefined) {
  return Boolean(id?.startsWith("manual-") || id?.startsWith("STUB-"));
}
