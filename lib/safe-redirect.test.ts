import { describe, expect, it } from "vitest";
import { safeRelativeRedirect } from "./safe-redirect";

describe("safeRelativeRedirect", () => {
  it("allows same-site relative paths with query strings", () => {
    expect(safeRelativeRedirect("/dashboard")).toBe("/dashboard");
    expect(safeRelativeRedirect("/albums/not-a-real-id?tab=pricing")).toBe(
      "/albums/not-a-real-id?tab=pricing"
    );
  });

  it("rejects missing, absolute, and protocol-relative destinations", () => {
    expect(safeRelativeRedirect(null)).toBeNull();
    expect(safeRelativeRedirect("")).toBeNull();
    expect(safeRelativeRedirect("https://example.com")).toBeNull();
    expect(safeRelativeRedirect("//example.com")).toBeNull();
    expect(safeRelativeRedirect("dashboard")).toBeNull();
  });
});
