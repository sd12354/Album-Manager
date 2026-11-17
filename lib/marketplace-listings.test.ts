import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listings";

describe("resolveListingPrice", () => {
  it("uses requested price before stored prices", () => {
    expect(resolveListingPrice(12.5, { list_price: 10, suggested_price: 8 })).toBe(
      12.5
    );
  });

  it("falls back to list price, then suggested price", () => {
    expect(resolveListingPrice(undefined, { list_price: 10, suggested_price: 8 })).toBe(
      10
    );
    expect(resolveListingPrice(undefined, { list_price: null, suggested_price: 8 })).toBe(
      8
    );
  });

  it("rejects missing or non-positive prices instead of inventing a default", () => {
    expect(resolveListingPrice(undefined, { list_price: null, suggested_price: null })).toBeNull();
    expect(resolveListingPrice(0, { list_price: 10, suggested_price: 8 })).toBeNull();
    expect(resolveListingPrice(-1, { list_price: 10, suggested_price: 8 })).toBeNull();
  });
});

describe("isLocalMarketplaceListingId", () => {
  it("recognizes manual and stub listing IDs as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
  });

  it("does not treat real marketplace IDs as local", () => {
    expect(isLocalMarketplaceListingId("123456")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });
});
