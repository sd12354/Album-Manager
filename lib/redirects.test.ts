import { describe, expect, it } from "vitest";
import { sanitizeInternalRedirect } from "./redirects";

describe("sanitizeInternalRedirect", () => {
  it("keeps safe relative paths with query strings and hashes", () => {
    expect(sanitizeInternalRedirect("/albums/abc?tab=pricing#top")).toBe(
      "/albums/abc?tab=pricing#top"
    );
  });

  it("falls back for missing or non-relative values", () => {
    expect(sanitizeInternalRedirect(null)).toBe("/dashboard");
    expect(sanitizeInternalRedirect("")).toBe("/dashboard");
    expect(sanitizeInternalRedirect("dashboard")).toBe("/dashboard");
    expect(sanitizeInternalRedirect("https://evil.example/path")).toBe(
      "/dashboard"
    );
    expect(sanitizeInternalRedirect("//evil.example/path")).toBe("/dashboard");
  });

  it("uses a caller-provided fallback", () => {
    expect(sanitizeInternalRedirect("https://evil.example", "/")).toBe("/");
  });
});
