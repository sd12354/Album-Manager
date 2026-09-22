import { describe, expect, it } from "vitest";
import { buildProtectedRedirect, sanitizeRedirectPath } from "./redirects";

describe("auth redirect helpers", () => {
  it("preserves safe relative paths with query strings", () => {
    expect(sanitizeRedirectPath("/albums?add=true")).toBe("/albums?add=true");
    expect(buildProtectedRedirect("/dashboard", "?tab=sales")).toBe(
      "/dashboard?tab=sales"
    );
  });

  it("falls back for external or protocol-relative destinations", () => {
    expect(sanitizeRedirectPath("https://evil.example/phish")).toBe("/dashboard");
    expect(sanitizeRedirectPath("//evil.example/phish")).toBe("/dashboard");
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("uses a caller-provided fallback when no safe path exists", () => {
    expect(sanitizeRedirectPath(null, "/login")).toBe("/login");
    expect(sanitizeRedirectPath("not-a-path", "/login")).toBe("/login");
  });
});
