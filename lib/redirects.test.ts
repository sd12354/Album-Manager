import { describe, expect, it } from "vitest";
import { sanitizeInternalRedirect } from "./redirects";

describe("sanitizeInternalRedirect", () => {
  it("keeps relative app paths with query strings", () => {
    expect(sanitizeInternalRedirect("/albums?sort=artist")).toBe(
      "/albums?sort=artist"
    );
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(sanitizeInternalRedirect("https://evil.example/phish")).toBe(
      "/dashboard"
    );
    expect(sanitizeInternalRedirect("//evil.example/phish")).toBe("/dashboard");
  });

  it("uses the provided fallback for missing or malformed values", () => {
    expect(sanitizeInternalRedirect(null, "/login")).toBe("/login");
    expect(sanitizeInternalRedirect("%E0%A4%A", "/login")).toBe("/login");
  });
});
