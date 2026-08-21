import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "./safe-redirect";

describe("getSafeRedirectPath", () => {
  it("allows relative app paths with query strings and hashes", () => {
    expect(getSafeRedirectPath("/albums/123?tab=pricing#notes")).toBe(
      "/albums/123?tab=pricing#notes"
    );
  });

  it("rejects absolute and protocol-relative redirects", () => {
    expect(getSafeRedirectPath("https://evil.example/phish")).toBe("/dashboard");
    expect(getSafeRedirectPath("//evil.example/phish")).toBe("/dashboard");
  });

  it("falls back for empty or malformed values", () => {
    expect(getSafeRedirectPath(null)).toBe("/dashboard");
    expect(getSafeRedirectPath("")).toBe("/dashboard");
    expect(getSafeRedirectPath("not-a-path")).toBe("/dashboard");
  });
}
