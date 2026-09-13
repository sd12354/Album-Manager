import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "./safe-redirect";

describe("getSafeRedirectPath", () => {
  it("keeps safe app-relative paths including query strings", () => {
    expect(getSafeRedirectPath("/albums?missing=photos")).toBe(
      "/albums?missing=photos"
    );
  });

  it("rejects absolute and protocol-relative redirects", () => {
    expect(getSafeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(getSafeRedirectPath("//evil.example/path")).toBe("/dashboard");
    expect(getSafeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("uses the provided fallback for unsafe or missing values", () => {
    expect(getSafeRedirectPath(null, "/login")).toBe("/login");
    expect(getSafeRedirectPath("%E0%A4%A", "/login")).toBe("/login");
  });
});
