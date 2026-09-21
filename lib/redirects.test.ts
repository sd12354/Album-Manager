import { describe, expect, it } from "vitest";
import { getProtectedNextPath, sanitizeRedirectPath } from "./redirects";

describe("redirect helpers", () => {
  it("keeps safe relative paths with query strings", () => {
    expect(sanitizeRedirectPath("/albums?add=true")).toBe("/albums?add=true");
  });

  it("rejects absolute and protocol-relative destinations", () => {
    expect(sanitizeRedirectPath("https://evil.example/phish")).toBe("/dashboard");
    expect(sanitizeRedirectPath("//evil.example/phish")).toBe("/dashboard");
  });

  it("builds protected next paths without leaking origin", () => {
    const url = new URL("https://app.example/dashboard?view=sold");
    expect(getProtectedNextPath(url)).toBe("/dashboard?view=sold");
  });
});
