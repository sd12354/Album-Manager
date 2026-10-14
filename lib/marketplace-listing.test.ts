import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listing";

describe("marketplace listing helpers", () => {
  it("recognizes manual and stub listing IDs as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-ebay-1")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123456")).toBe(true);
    expect(isLocalMarketplaceListingId("123456")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });

  it("uses requested price before album prices", () => {
    expect(resolveListingPrice(18, 20, 22)).toBe(18);
  });

  it("falls back to stored list price and suggested price", () => {
    expect(resolveListingPrice(undefined, 20, 22)).toBe(20);
    expect(resolveListingPrice(undefined, null, 22)).toBe(22);
  });

  it("does not invent a fallback price for unpriced albums", () => {
    expect(resolveListingPrice(undefined, null, null)).toBeNull();
    expect(resolveListingPrice(undefined, 0, 22)).toBeNull();
    expect(resolveListingPrice(Number.NaN, 20, 22)).toBeNull();
  });
});
