import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace";

describe("marketplace helpers", () => {
  it("treats manual and stub listing IDs as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListingId("1234567890")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });

  it("prefers a positive requested list price", () => {
    expect(
      resolveListingPrice(42, { list_price: 20, suggested_price: 15 })
    ).toBe(42);
  });

  it("falls back to stored positive prices but never invents a default", () => {
    expect(
      resolveListingPrice(undefined, { list_price: 0, suggested_price: 15 })
    ).toBe(15);
    expect(
      resolveListingPrice(undefined, { list_price: null, suggested_price: 0 })
    ).toBeNull();
  });
});
