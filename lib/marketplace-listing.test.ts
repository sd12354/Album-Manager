import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listing";

describe("marketplace listing helpers", () => {
  it("uses an explicit requested price before album prices", () => {
    expect(
      resolveListingPrice({
        requestedPrice: 22,
        listPrice: 18,
        suggestedPrice: 16,
      })
    ).toBe(22);
  });

  it("falls back only to real positive album prices", () => {
    expect(resolveListingPrice({ listPrice: 0, suggestedPrice: 14 })).toBe(14);
    expect(resolveListingPrice({ listPrice: null, suggestedPrice: null })).toBeNull();
  });

  it("does not invent a default listing price", () => {
    expect(resolveListingPrice({})).toBeNull();
  });

  it("treats manual and stub listings as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListingId("123456")).toBe(false);
  });
});
