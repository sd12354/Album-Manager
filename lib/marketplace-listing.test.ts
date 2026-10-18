import { describe, expect, it } from "vitest";
import { isLocalMarketplaceListingId, resolveListingPrice } from "./marketplace-listing";

describe("marketplace listing helpers", () => {
  it("uses the requested price before album prices", () => {
    expect(resolveListingPrice(12, 20, 30)).toBe(12);
  });

  it("falls back to saved album prices without inventing a default", () => {
    expect(resolveListingPrice(undefined, 20, 30)).toBe(20);
    expect(resolveListingPrice(undefined, null, 30)).toBe(30);
    expect(resolveListingPrice(undefined, null, null)).toBeNull();
    expect(resolveListingPrice(0, 20, 30)).toBeNull();
  });

  it("recognizes manual and local stub marketplace ids", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListingId("123")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });
});
