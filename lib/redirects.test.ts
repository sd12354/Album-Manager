import { describe, expect, it } from "vitest";
import { getRelativePath, getSafeRedirectPath } from "./redirects";

describe("redirect helpers", () => {
  it("builds a relative path with the original query string", () => {
    const url = new URL("https://vinylvault.example/albums?sort=artist");

    expect(getRelativePath(url)).toBe("/albums?sort=artist");
  });

  it("allows internal redirect paths", () => {
    expect(getSafeRedirectPath("/albums?sort=artist")).toBe(
      "/albums?sort=artist"
    );
  });

  it("rejects absolute URLs", () => {
    expect(getSafeRedirectPath("https://evil.example/albums")).toBe(
      "/dashboard"
    );
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeRedirectPath("//evil.example/albums")).toBe("/dashboard");
  });

  it("rejects encoded protocol-relative URLs", () => {
    expect(getSafeRedirectPath("%2F%2Fevil.example/albums")).toBe(
      "/dashboard"
    );
  });
});
