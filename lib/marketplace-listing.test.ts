import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listing";

describe("resolveListingPrice", () => {
  it("prefers a requested price over stored album prices", () => {
    expect(resolveListingPrice({ list_price: 20, suggested_price: 30 }, 15)).toBe(
      15
    );
  });

  it("falls back to stored positive prices without inventing one", () => {
    expect(resolveListingPrice({ list_price: 20, suggested_price: 30 })).toBe(20);
    expect(resolveListingPrice({ list_price: null, suggested_price: 30 })).toBe(
      30
    );
    expect(resolveListingPrice({ list_price: null, suggested_price: null })).toBe(
      null
    );
  });

  it("rejects zero, negative, and non-finite prices", () => {
    expect(resolveListingPrice({ list_price: 0, suggested_price: null })).toBe(
      null
    );
    expect(resolveListingPrice({ list_price: -1, suggested_price: 25 })).toBe(
      null
    );
    expect(resolveListingPrice({ list_price: null, suggested_price: 25 }, NaN)).toBe(
      null
    );
  });
});

describe("isLocalMarketplaceListingId", () => {
  it("recognizes manually tracked and stub listings as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
  });

  it("does not mark real marketplace IDs as local", () => {
    expect(isLocalMarketplaceListingId("123456")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });
});
