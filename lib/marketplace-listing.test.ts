import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listing";

describe("marketplace listing helpers", () => {
  it("treats manual and stub listings as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListingId("123456789")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });

  it("uses only real positive listing prices", () => {
    expect(resolveListingPrice(20, { list_price: 10, suggested_price: 5 })).toBe(20);
    expect(resolveListingPrice(undefined, { list_price: 10, suggested_price: 5 })).toBe(10);
    expect(resolveListingPrice(undefined, { list_price: null, suggested_price: 5 })).toBe(5);
    expect(resolveListingPrice(undefined, { list_price: null, suggested_price: null })).toBeNull();
    expect(resolveListingPrice(0, { list_price: 10, suggested_price: 5 })).toBeNull();
  });
});

