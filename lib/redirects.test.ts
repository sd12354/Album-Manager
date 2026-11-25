import { describe, expect, it } from "vitest";
import { sanitizeRedirectPath } from "./redirects";

describe("sanitizeRedirectPath", () => {
  it("preserves internal paths with query strings and hashes", () => {
    expect(sanitizeRedirectPath("/dashboard?tab=stats#top")).toBe(
      "/dashboard?tab=stats#top"
    );
    expect(sanitizeRedirectPath("/albums/abc?foo=bar")).toBe(
      "/albums/abc?foo=bar"
    );
  });

  it("rejects absolute and protocol-relative redirect targets", () => {
    expect(sanitizeRedirectPath("https://evil.example/path")).toBe("/dashboard");
    expect(sanitizeRedirectPath("//evil.example/path")).toBe("/dashboard");
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("uses the supplied fallback for blank or malformed values", () => {
    expect(sanitizeRedirectPath(null, "/login")).toBe("/login");
    expect(sanitizeRedirectPath("   ", "/login")).toBe("/login");
    expect(sanitizeRedirectPath("dashboard", "/login")).toBe("/login");
  });
});
