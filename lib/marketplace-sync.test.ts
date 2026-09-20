import { describe, expect, it } from "vitest";
import { isLocalMarketplaceListingId } from "./marketplace-listing-id";

describe("isLocalMarketplaceListingId", () => {
  it("detects manual and stub listings as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
  });

  it("does not treat marketplace-issued IDs as local", () => {
    expect(isLocalMarketplaceListingId("1234567890")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });
});
