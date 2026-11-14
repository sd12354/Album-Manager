import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listing";

describe("resolveListingPrice", () => {
  it("prefers an explicit positive requested price", () => {
    expect(resolveListingPrice({ list_price: 12, suggested_price: 15 }, 20)).toBe(
      20
    );
  });

  it("falls back to stored prices but never invents a default", () => {
    expect(resolveListingPrice({ list_price: 12, suggested_price: 15 })).toBe(12);
    expect(resolveListingPrice({ list_price: null, suggested_price: 15 })).toBe(15);
    expect(resolveListingPrice({ list_price: null, suggested_price: null })).toBeNull();
  });

  it("rejects zero, negative, and non-finite prices", () => {
    expect(resolveListingPrice({ list_price: 0, suggested_price: null })).toBeNull();
    expect(resolveListingPrice({ list_price: -1, suggested_price: null })).toBeNull();
    expect(resolveListingPrice({ list_price: Number.NaN, suggested_price: null })).toBeNull();
  });
});

describe("isLocalMarketplaceListingId", () => {
  it("recognizes manual and stub listing identifiers", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListingId("123456")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });
});
