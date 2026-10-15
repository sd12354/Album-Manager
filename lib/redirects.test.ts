import { describe, expect, it } from "vitest";
import { sanitizeInternalRedirect } from "./redirects";

describe("sanitizeInternalRedirect", () => {
  it("keeps relative app paths with query strings", () => {
    expect(sanitizeInternalRedirect("/albums?sort=artist")).toBe(
      "/albums?sort=artist"
    );
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(sanitizeInternalRedirect("https://evil.example/albums")).toBe(
      "/dashboard"
    );
    expect(sanitizeInternalRedirect("//evil.example/albums")).toBe(
      "/dashboard"
    );
  });
});
