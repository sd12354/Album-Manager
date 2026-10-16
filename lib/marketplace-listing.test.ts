import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listing";

describe("resolveListingPrice", () => {
  it("uses an explicit positive requested price first", () => {
    expect(resolveListingPrice(15, { list_price: 20, suggested_price: 25 })).toBe(
      15
    );
  });

  it("falls back to existing album prices but never invents a default", () => {
    expect(resolveListingPrice(undefined, { list_price: null, suggested_price: 12 })).toBe(
      12
    );
    expect(resolveListingPrice(undefined, { list_price: null, suggested_price: null })).toBe(
      null
    );
  });

  it("rejects zero, negative, and non-finite prices", () => {
    expect(resolveListingPrice(0, { list_price: 12, suggested_price: 13 })).toBeNull();
    expect(resolveListingPrice(-1, { list_price: 12, suggested_price: 13 })).toBeNull();
    expect(resolveListingPrice(Number.NaN, { list_price: 12, suggested_price: 13 })).toBeNull();
  });
});

describe("isLocalMarketplaceListingId", () => {
  it("recognizes manual and stub IDs as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
  });

  it("leaves real marketplace IDs alone", () => {
    expect(isLocalMarketplaceListingId("123456789")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });
});
