import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  resolveListingPrice,
} from "./marketplace-listing";

describe("marketplace listing helpers", () => {
  it("detects local-only marketplace listing ids", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListingId("987654321")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });

  it("uses requested, list, then suggested price without a fallback", () => {
    expect(resolveListingPrice(12, 10, 8)).toBe(12);
    expect(resolveListingPrice(undefined, 10, 8)).toBe(10);
    expect(resolveListingPrice(undefined, undefined, 8)).toBe(8);
    expect(resolveListingPrice(undefined, undefined, undefined)).toBeNull();
    expect(resolveListingPrice(0, 10, 8)).toBeNull();
  });
});
