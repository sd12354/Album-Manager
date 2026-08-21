import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listing";

describe("marketplace listing helpers", () => {
  it("treats manual and stub IDs as local-only listings", () => {
    expect(isLocalMarketplaceListingId("manual-ebay-1")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListingId("123456789")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });

  it("requires an explicit or stored positive listing price", () => {
    expect(resolveListingPrice({ list_price: null, suggested_price: null })).toBeNull();
    expect(resolveListingPrice({ list_price: 0, suggested_price: null })).toBeNull();
    expect(resolveListingPrice({ list_price: null, suggested_price: 18 })).toBe(18);
    expect(resolveListingPrice({ list_price: 22, suggested_price: 18 })).toBe(22);
    expect(resolveListingPrice({ list_price: 22, suggested_price: 18 }, 30)).toBe(30);
  });
});
