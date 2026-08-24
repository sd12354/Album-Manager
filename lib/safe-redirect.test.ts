import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "./safe-redirect";

describe("getSafeRedirectPath", () => {
  it("preserves safe relative destinations with query strings", () => {
    expect(getSafeRedirectPath("/albums?add=true")).toBe("/albums?add=true");
  });

  it("rejects absolute and protocol-relative destinations", () => {
    expect(getSafeRedirectPath("https://evil.example/albums")).toBe("/dashboard");
    expect(getSafeRedirectPath("//evil.example/albums")).toBe("/dashboard");
  });

  it("avoids redirecting back to auth pages", () => {
    expect(getSafeRedirectPath("/login?next=/albums")).toBe("/dashboard");
    expect(getSafeRedirectPath("/signup")).toBe("/dashboard");
  });

  it("uses the supplied fallback for missing or invalid values", () => {
    expect(getSafeRedirectPath(null, "/albums")).toBe("/albums");
    expect(getSafeRedirectPath("https://evil.example", "/albums")).toBe("/albums");
  });
});
