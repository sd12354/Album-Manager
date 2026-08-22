import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "./safe-redirect";

describe("getSafeRedirectPath", () => {
  it("preserves relative app paths with query strings and hashes", () => {
    expect(getSafeRedirectPath("/albums/abc?tab=pricing#photos")).toBe(
      "/albums/abc?tab=pricing#photos"
    );
  });

  it("falls back for absolute or protocol-relative destinations", () => {
    expect(getSafeRedirectPath("https://evil.example/dashboard")).toBe("/dashboard");
    expect(getSafeRedirectPath("//evil.example/dashboard")).toBe("/dashboard");
  });

  it("falls back for malformed local paths", () => {
    expect(getSafeRedirectPath("/\\evil.example")).toBe("/dashboard");
    expect(getSafeRedirectPath("/albums\u0000/settings")).toBe("/dashboard");
  });

  it("uses a custom fallback when provided", () => {
    expect(getSafeRedirectPath(null, "/login")).toBe("/login");
  });
});
