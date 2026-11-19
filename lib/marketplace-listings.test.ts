import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listings";

describe("isLocalMarketplaceListingId", () => {
  it("treats manual and stub listings as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
  });

  it("does not treat real marketplace ids as local", () => {
    expect(isLocalMarketplaceListingId("1234567890")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });
});

describe("resolveListingPrice", () => {
  it("uses the first positive finite price in request/list/suggested order", () => {
    expect(resolveListingPrice(18, 12, 10)).toBe(18);
    expect(resolveListingPrice(undefined, 12, 10)).toBe(12);
    expect(resolveListingPrice(undefined, null, 10)).toBe(10);
  });

  it("rejects zero, negative, missing, and non-finite prices", () => {
    expect(resolveListingPrice(0, -1, undefined)).toBeNull();
    expect(resolveListingPrice(Number.NaN, Number.POSITIVE_INFINITY, null)).toBeNull();
  });
});

