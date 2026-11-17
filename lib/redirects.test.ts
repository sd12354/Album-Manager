import { describe, expect, it } from "vitest";
import {
  authCallbackUrl,
  DEFAULT_AUTH_REDIRECT,
  sanitizeInternalRedirect,
} from "./redirects";

describe("sanitizeInternalRedirect", () => {
  it("keeps internal paths with query strings and hashes", () => {
    expect(sanitizeInternalRedirect("/albums?add=true#manual")).toBe(
      "/albums?add=true#manual"
    );
  });

  it("falls back for missing values", () => {
    expect(sanitizeInternalRedirect(null)).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeInternalRedirect("")).toBe(DEFAULT_AUTH_REDIRECT);
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(sanitizeInternalRedirect("https://evil.example/albums")).toBe(
      DEFAULT_AUTH_REDIRECT
    );
    expect(sanitizeInternalRedirect("//evil.example/albums")).toBe(
      DEFAULT_AUTH_REDIRECT
    );
  });

  it("rejects encoded absolute URLs", () => {
    expect(
      sanitizeInternalRedirect(encodeURIComponent("https://evil.example"))
    ).toBe(DEFAULT_AUTH_REDIRECT);
  });
});

describe("authCallbackUrl", () => {
  it("builds a callback route with an encoded safe next destination", () => {
    expect(authCallbackUrl("/settings?tab=account")).toBe(
      "/auth/callback?next=%2Fsettings%3Ftab%3Daccount"
    );
  });

  it("falls back to the dashboard for unsafe destinations", () => {
    expect(authCallbackUrl("https://evil.example")).toBe(
      "/auth/callback?next=%2Fdashboard"
    );
  });
});
