export function isLocalMarketplaceListingId(id: string | null | undefined): boolean {
  const normalized = id?.trim().toLowerCase();
  return Boolean(
    normalized &&
      (normalized.startsWith("manual-") || normalized.startsWith("stub-"))
  );
}
