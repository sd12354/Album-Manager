import { describe, expect, it } from "vitest";
import { createLoginRedirectUrl, sanitizeInternalRedirect } from "./redirects";

describe("sanitizeInternalRedirect", () => {
  it("keeps relative app destinations intact", () => {
    expect(sanitizeInternalRedirect("/dashboard")).toBe("/dashboard");
    expect(sanitizeInternalRedirect("/albums/123?tab=photos#cover")).toBe(
      "/albums/123?tab=photos#cover"
    );
  });

  it("rejects absolute and protocol-relative destinations", () => {
    expect(sanitizeInternalRedirect("https://evil.example/dashboard")).toBe(
      "/dashboard"
    );
    expect(sanitizeInternalRedirect("//evil.example/dashboard")).toBe(
      "/dashboard"
    );
    expect(sanitizeInternalRedirect(null)).toBe("/dashboard");
  });
});

describe("createLoginRedirectUrl", () => {
  it("moves protected route state into a single safe next parameter", () => {
    const url = createLoginRedirectUrl(
      new URL("https://app.example/dashboard?tab=pricing&sort=desc")
    );

    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("tab")).toBeNull();
    expect(url.searchParams.get("sort")).toBeNull();
    expect(url.searchParams.get("next")).toBe("/dashboard?tab=pricing&sort=desc");
  });
});
