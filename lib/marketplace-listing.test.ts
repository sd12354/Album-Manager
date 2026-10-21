import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveMarketplaceListPrice,
} from "./marketplace-listing";

describe("marketplace listing helpers", () => {
  it("treats manual and stub listing IDs as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListingId("123456789")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });

  it("uses the first positive requested, saved, or suggested list price", () => {
    expect(
      resolveMarketplaceListPrice({
        requestedPrice: 25,
        savedListPrice: 20,
        suggestedPrice: 15,
      })
    ).toBe(25);
    expect(
      resolveMarketplaceListPrice({
        savedListPrice: 20,
        suggestedPrice: 15,
      })
    ).toBe(20);
    expect(resolveMarketplaceListPrice({ suggestedPrice: 15 })).toBe(15);
  });

  it("does not fall back when an explicit invalid price is supplied", () => {
    expect(
      resolveMarketplaceListPrice({
        requestedPrice: 0,
        savedListPrice: 20,
        suggestedPrice: 15,
      })
    ).toBe(null);
  });

  it("rejects missing or invalid stored marketplace prices", () => {
    expect(resolveMarketplaceListPrice({})).toBe(null);
    expect(resolveMarketplaceListPrice({ savedListPrice: -1 })).toBe(null);
    expect(resolveMarketplaceListPrice({ suggestedPrice: Number.NaN })).toBe(null);
  });
});
