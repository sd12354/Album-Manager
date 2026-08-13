import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveMarketplaceListPrice,
} from "./marketplace-listing";

describe("marketplace listing helpers", () => {
  it("treats manual and stub listing IDs as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListingId("987654321")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });

  it("uses requested, saved, then suggested prices without a default fallback", () => {
    expect(resolveMarketplaceListPrice(12, 9, 7)).toBe(12);
    expect(resolveMarketplaceListPrice(undefined, 9, 7)).toBe(9);
    expect(resolveMarketplaceListPrice(undefined, null, 7)).toBe(7);
    expect(resolveMarketplaceListPrice(undefined, null, null)).toBeNull();
  });

  it("rejects non-positive marketplace prices", () => {
    expect(resolveMarketplaceListPrice(0, 9, 7)).toBeNull();
    expect(resolveMarketplaceListPrice(-1, 9, 7)).toBeNull();
  });
});
