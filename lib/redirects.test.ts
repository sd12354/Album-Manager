import { describe, expect, it } from "vitest";
import { redirectPathWithSearch, safeInternalRedirect } from "./redirects";

describe("safeInternalRedirect", () => {
  it("keeps internal paths with search and hash", () => {
    expect(safeInternalRedirect("/albums/123?tab=pricing#history")).toBe(
      "/albums/123?tab=pricing#history"
    );
  });

  it("rejects absolute and protocol-relative redirects", () => {
    expect(safeInternalRedirect("https://evil.example/path")).toBe("/dashboard");
    expect(safeInternalRedirect("//evil.example/path")).toBe("/dashboard");
  });

  it("rejects malformed or non-path redirects", () => {
    expect(safeInternalRedirect("dashboard")).toBe("/dashboard");
    expect(safeInternalRedirect("/\n/dashboard")).toBe("/dashboard");
  });
});

describe("redirectPathWithSearch", () => {
  it("preserves the protected route as a login next target", () => {
    expect(redirectPathWithSearch("/albums", "?status=listed")).toBe(
      "/albums?status=listed"
    );
  });
});
