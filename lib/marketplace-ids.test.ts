import { describe, expect, it } from "vitest";
import {
  isLocalMarketplaceListingId,
  isManualMarketplaceListingId,
  isStubMarketplaceListingId,
} from "./marketplace-ids";

describe("marketplace listing id helpers", () => {
  it("detects stub marketplace IDs case-insensitively", () => {
    expect(isStubMarketplaceListingId("STUB-123")).toBe(true);
    expect(isStubMarketplaceListingId(" stub-123 ")).toBe(true);
    expect(isStubMarketplaceListingId("manual-123")).toBe(false);
  });

  it("detects manual marketplace IDs case-insensitively", () => {
    expect(isManualMarketplaceListingId("manual-123")).toBe(true);
    expect(isManualMarketplaceListingId(" MANUAL-123 ")).toBe(true);
    expect(isManualMarketplaceListingId("123456")).toBe(false);
  });

  it("treats only manual and stub IDs as local listings", () => {
    expect(isLocalMarketplaceListingId("manual-123")).toBe(true);
    expect(isLocalMarketplaceListingId("STUB-123")).toBe(true);
    expect(isLocalMarketplaceListingId("1234567890")).toBe(false);
    expect(isLocalMarketplaceListingId(null)).toBe(false);
  });
});
