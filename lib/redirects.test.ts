import { describe, expect, it } from "vitest";
import { sanitizeInternalRedirect } from "./redirects";

describe("sanitizeInternalRedirect", () => {
  it("keeps relative app paths including query strings", () => {
    expect(
      sanitizeInternalRedirect("/albums?status=listed&sort=title")
    ).toBe("/albums?status=listed&sort=title");
  });

  it("rejects external and protocol-relative URLs", () => {
    expect(sanitizeInternalRedirect("https://evil.example/path")).toBe(
      "/dashboard"
    );
    expect(sanitizeInternalRedirect("//evil.example/path")).toBe("/dashboard");
  });

  it("uses the supplied fallback for empty or invalid values", () => {
    expect(sanitizeInternalRedirect(null, "/login")).toBe("/login");
    expect(sanitizeInternalRedirect("not-a-path", "/login")).toBe("/login");
  });
});
