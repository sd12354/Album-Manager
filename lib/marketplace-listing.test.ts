import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listing";

describe("marketplace listing helpers", () => {
  it("uses the requested positive price before stored prices", () => {
    expect(resolveListingPrice(12.5, 20, 30)).toBe(12.5);
  });

  it("falls back to stored list then suggested prices", () => {
    expect(resolveListingPrice(undefined, 20, 30)).toBe(20);
    expect(resolveListingPrice(undefined, null, 30)).toBe(30);
    expect(resolveListingPrice(undefined, 0, 30)).toBe(30);
  });

  it("does not invent a listing price when no positive price exists", () => {
    expect(resolveListingPrice(undefined, null, null)).toBeNull();
    expect(resolveListingPrice(undefined, 0, 0)).toBeNull();
    expect(resolveListingPrice(-1, 20, 30)).toBeNull();
  });

  it("recognizes manual and stub IDs as local-only listings", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListingId("123456789")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });
});
