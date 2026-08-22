import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveMarketplaceListPrice,
} from "./marketplace-listing";

describe("marketplace listing helpers", () => {
  it("requires an explicit positive requested, list, or suggested price", () => {
    expect(resolveMarketplaceListPrice({ list_price: null, suggested_price: null })).toBeNull();
    expect(resolveMarketplaceListPrice({ list_price: 0, suggested_price: null })).toBeNull();
    expect(resolveMarketplaceListPrice({ list_price: null, suggested_price: -1 })).toBeNull();
  });

  it("prefers requested price, then saved list price, then suggested price", () => {
    expect(resolveMarketplaceListPrice({ list_price: 12, suggested_price: 20 }, 30)).toBe(30);
    expect(resolveMarketplaceListPrice({ list_price: 12, suggested_price: 20 })).toBe(12);
    expect(resolveMarketplaceListPrice({ list_price: null, suggested_price: 20 })).toBe(20);
  });

  it("recognizes local-only marketplace listing IDs", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListingId("1234567890")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });
});
