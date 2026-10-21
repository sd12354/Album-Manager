export function isStubMarketplaceListingId(id: string | null | undefined): boolean {
  return (id ?? "").trim().toLowerCase().startsWith("stub-");
}

export function isManualMarketplaceListingId(id: string | null | undefined): boolean {
  return (id ?? "").trim().toLowerCase().startsWith("manual-");
}

export function isLocalMarketplaceListingId(id: string | null | undefined): boolean {
  return isManualMarketplaceListingId(id) || isStubMarketplaceListingId(id);
}
