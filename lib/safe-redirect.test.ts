import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("allows internal absolute paths with query strings", () => {
    expect(safeRedirectPath("/albums?missing=photos")).toBe(
      "/albums?missing=photos"
    );
  });

  it("decodes encoded internal paths", () => {
    expect(safeRedirectPath("/settings%3Fsection%3Dshipping")).toBe(
      "/settings?section=shipping"
    );
  });

  it("rejects external and protocol-relative URLs", () => {
    expect(safeRedirectPath("https://evil.example/albums")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.example/albums")).toBe("/dashboard");
  });

  it("uses the provided fallback for invalid input", () => {
    expect(safeRedirectPath(null, "/login")).toBe("/login");
    expect(safeRedirectPath("%", "/login")).toBe("/login");
  });
});
