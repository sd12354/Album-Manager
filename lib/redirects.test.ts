import { describe, expect, it } from "vitest";
import {
  buildLoginRedirectUrl,
  getSafePostAuthRedirectPath,
} from "./redirects";

describe("post-auth redirects", () => {
  it("allows internal relative destinations with query strings and hashes", () => {
    expect(
      getSafePostAuthRedirectPath("/albums?sort=artist&dir=asc#top")
    ).toBe("/albums?sort=artist&dir=asc#top");
  });

  it("rejects external, protocol-relative, and auth-flow destinations", () => {
    expect(getSafePostAuthRedirectPath("https://evil.example/albums")).toBe(
      "/dashboard"
    );
    expect(getSafePostAuthRedirectPath("//evil.example/albums")).toBe(
      "/dashboard"
    );
    expect(getSafePostAuthRedirectPath("/login?next=/albums")).toBe(
      "/dashboard"
    );
  });

  it("builds login redirects without leaking protected route params onto login", () => {
    const url = buildLoginRedirectUrl(
      new URL("https://app.example/dashboard?tab=overview")
    );

    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("tab")).toBeNull();
    expect(url.searchParams.get("next")).toBe("/dashboard?tab=overview");
  });
});
