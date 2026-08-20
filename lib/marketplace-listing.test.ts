import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listing";

describe("resolveListingPrice", () => {
  it("uses the requested price before stored list and suggested prices", () => {
    expect(
      resolveListingPrice({
        requestedPrice: 12,
        listPrice: 15,
        suggestedPrice: 18,
      })
    ).toBe(12);
  });

  it("falls back to stored prices without inventing a default", () => {
    expect(resolveListingPrice({ listPrice: 15, suggestedPrice: 18 })).toBe(15);
    expect(resolveListingPrice({ suggestedPrice: 18 })).toBe(18);
    expect(resolveListingPrice({})).toBeNull();
  });

  it("rejects non-positive prices without falling through", () => {
    expect(resolveListingPrice({ requestedPrice: 0, listPrice: 15 })).toBeNull();
    expect(resolveListingPrice({ requestedPrice: -1, listPrice: 15 })).toBeNull();
  });
});

describe("isLocalMarketplaceListingId", () => {
  it("treats manual and stub IDs as local-only listings", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
  });

  it("does not treat real or missing listing IDs as local-only", () => {
    expect(isLocalMarketplaceListingId("1234567890")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
    expect(isLocalMarketplaceListingId(undefined)).toBe(false);
  });
});
