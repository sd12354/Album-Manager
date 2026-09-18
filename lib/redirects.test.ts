import { describe, expect, it } from "vitest";
import {
  authCallbackUrl,
  getSafeNextParam,
  safeInternalRedirect,
} from "./redirects";

describe("redirect helpers", () => {
  it("allows relative app paths with query strings", () => {
    expect(safeInternalRedirect("/albums?status=listed")).toBe(
      "/albums?status=listed"
    );
  });

  it("rejects absolute and protocol-relative destinations", () => {
    expect(safeInternalRedirect("https://evil.example/albums")).toBe(
      "/dashboard"
    );
    expect(safeInternalRedirect("//evil.example/albums")).toBe("/dashboard");
  });

  it("reads a safe next parameter with a fallback", () => {
    expect(getSafeNextParam(new URLSearchParams("next=/settings"))).toBe(
      "/settings"
    );
    expect(
      getSafeNextParam(new URLSearchParams("next=https://evil.example"))
    ).toBe("/dashboard");
  });

  it("builds Supabase auth callback links with sanitized next paths", () => {
    expect(authCallbackUrl("/update-password")).toBe(
      "/auth/callback?next=%2Fupdate-password"
    );
    expect(authCallbackUrl("https://evil.example")).toBe(
      "/auth/callback?next=%2Fdashboard"
    );
  });
});
