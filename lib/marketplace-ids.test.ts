import { describe, expect, it } from "vitest";
import { isLocalMarketplaceListingId } from "./marketplace-ids";

describe("marketplace listing id helpers", () => {
  it("recognizes manual and stub listing ids as local-only", () => {
    expect(isLocalMarketplaceListingId("manual-1712345678")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-1712345678")).toBe(true);
    expect(isLocalMarketplaceListingId(" stub-preview ")).toBe(true);
  });

  it("does not classify real marketplace ids as local-only", () => {
    expect(isLocalMarketplaceListingId("110012345678")).toBe(false);
    expect(isLocalMarketplaceListingId("987654321")).toBe(false);
    expect(isLocalMarketplaceListingId("")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
    expect(isLocalMarketplaceListingId(undefined)).toBe(false);
  });
});
