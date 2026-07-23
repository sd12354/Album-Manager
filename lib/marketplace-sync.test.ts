import { describe, expect, it } from "vitest";
import { isLocalMarketplaceListing } from "./marketplace-ids";

describe("marketplace sync helpers", () => {
  it("recognizes manual and stub listing IDs as local-only", () => {
    expect(isLocalMarketplaceListing("manual-123")).toBe(true);
    expect(isLocalMarketplaceListing("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListing("1234567890")).toBe(false);
    expect(isLocalMarketplaceListing(null)).toBe(false);
    expect(isLocalMarketplaceListing(undefined)).toBe(false);
  });
});
