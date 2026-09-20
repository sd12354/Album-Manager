import { describe, expect, it } from "vitest";
import { sanitizeInternalRedirect } from "./redirects";

describe("sanitizeInternalRedirect", () => {
  it("keeps safe internal paths with query strings", () => {
    expect(sanitizeInternalRedirect("/albums?add=true")).toBe("/albums?add=true");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(sanitizeInternalRedirect("https://evil.example/phish")).toBe("/dashboard");
    expect(sanitizeInternalRedirect("//evil.example/phish")).toBe("/dashboard");
  });

  it("falls back for empty or malformed values", () => {
    expect(sanitizeInternalRedirect(null, "/login")).toBe("/login");
    expect(sanitizeInternalRedirect("http://[", "/login")).toBe("/login");
  });
});
