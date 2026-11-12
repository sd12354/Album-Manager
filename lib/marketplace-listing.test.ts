import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listing";

describe("resolveListingPrice", () => {
  it("prefers requested price, then list price, then suggested price", () => {
    expect(resolveListingPrice(18, 20, 25)).toBe(18);
    expect(resolveListingPrice(undefined, 20, 25)).toBe(20);
    expect(resolveListingPrice(undefined, undefined, 25)).toBe(25);
  });

  it("does not invent a fallback price", () => {
    expect(resolveListingPrice(undefined, undefined, undefined)).toBeNull();
    expect(resolveListingPrice(null, null, null)).toBeNull();
  });

  it("rejects non-positive or non-finite prices", () => {
    expect(resolveListingPrice(0, 20, 25)).toBeNull();
    expect(resolveListingPrice(-1, 20, 25)).toBeNull();
    expect(resolveListingPrice(Number.NaN, 20, 25)).toBeNull();
  });
});

describe("isLocalMarketplaceListingId", () => {
  it("recognizes manual and stub-only listing IDs", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
  });

  it("does not treat real marketplace IDs as local", () => {
    expect(isLocalMarketplaceListingId("123456789")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });
});
