import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkBackendHealth,
  isBackendOutageError,
  isDowntimeExemptPath,
  isMaintenanceMode,
  maintenanceAllowsEmail,
  markBackendUnhealthy,
  resetBackendHealthCache,
} from "./backend-health";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://ref.supabase.co/",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
};

function respond(status: number) {
  return vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch;
}

describe("maintenance switch", () => {
  it("is off unless explicitly enabled", () => {
    expect(isMaintenanceMode({})).toBe(false);
    expect(isMaintenanceMode({ MAINTENANCE_MODE: "0" })).toBe(false);
    expect(isMaintenanceMode({ MAINTENANCE_MODE: "false" })).toBe(false);
    expect(isMaintenanceMode({ MAINTENANCE_MODE: " TRUE " })).toBe(true);
    expect(isMaintenanceMode({ MAINTENANCE_MODE: "1" })).toBe(true);
  });

  it("lets only listed accounts through", () => {
    const e = { MAINTENANCE_ALLOW_EMAILS: "Owner@Example.com, second@example.com" };
    expect(maintenanceAllowsEmail("owner@example.com", e)).toBe(true);
    expect(maintenanceAllowsEmail(" SECOND@example.com ", e)).toBe(true);
    expect(maintenanceAllowsEmail("client@example.com", e)).toBe(false);
    expect(maintenanceAllowsEmail(null, e)).toBe(false);
    expect(maintenanceAllowsEmail("owner@example.com", {})).toBe(false);
  });

  it("keeps the downtime page and its health checks reachable", () => {
    expect(isDowntimeExemptPath("/maintenance")).toBe(true);
    expect(isDowntimeExemptPath("/api/health")).toBe(true);
    expect(isDowntimeExemptPath("/api/keepalive")).toBe(true);
    expect(isDowntimeExemptPath("/api/ebay/account-deletion")).toBe(true);
    expect(isDowntimeExemptPath("/login")).toBe(false);
    expect(isDowntimeExemptPath("/api/albums/import")).toBe(false);
  });
});

describe("outage detection", () => {
  it("separates outages from ordinary auth errors", () => {
    expect(isBackendOutageError({ name: "AuthRetryableFetchError", status: 0 })).toBe(true);
    expect(isBackendOutageError({ name: "AuthApiError", status: 402 })).toBe(true);
    expect(isBackendOutageError({ name: "AuthApiError", status: 540 })).toBe(true);
    expect(isBackendOutageError({ name: "AuthSessionMissingError", status: 400 })).toBe(false);
    expect(isBackendOutageError({ name: "AuthApiError", status: 401 })).toBe(false);
    expect(isBackendOutageError(null)).toBe(false);
  });
});

describe("checkBackendHealth", () => {
  beforeEach(() => resetBackendHealthCache());

  it("reports healthy on a normal response and sends the API key", async () => {
    const fetchImpl = respond(200);
    const health = await checkBackendHealth({ env, fetchImpl, now: 1000 });
    expect(health.ok).toBe(true);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://ref.supabase.co/auth/v1/health");
    expect((init as RequestInit).headers).toEqual({ apikey: "anon" });
  });

  it("treats a paused or restricted project as down", async () => {
    expect((await checkBackendHealth({ env, fetchImpl: respond(540), now: 1 })).ok).toBe(false);
    resetBackendHealthCache();
    expect((await checkBackendHealth({ env, fetchImpl: respond(402), now: 1 })).ok).toBe(false);
  });

  it("treats a network failure as down", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const health = await checkBackendHealth({ env, fetchImpl, now: 1 });
    expect(health).toMatchObject({ ok: false, reason: "unreachable" });
  });

  it("does not call a client-side misconfiguration an outage", async () => {
    expect((await checkBackendHealth({ env, fetchImpl: respond(401), now: 1 })).ok).toBe(true);
  });

  it("caches healthy results for a minute and unhealthy ones briefly", async () => {
    const up = respond(200);
    await checkBackendHealth({ env, fetchImpl: up, now: 0 });
    await checkBackendHealth({ env, fetchImpl: up, now: 59_000 });
    expect(up).toHaveBeenCalledTimes(1);
    await checkBackendHealth({ env, fetchImpl: up, now: 61_000 });
    expect(up).toHaveBeenCalledTimes(2);

    resetBackendHealthCache();
    const down = respond(503);
    await checkBackendHealth({ env, fetchImpl: down, now: 0 });
    await checkBackendHealth({ env, fetchImpl: down, now: 10_000 });
    expect(down).toHaveBeenCalledTimes(1);
    await checkBackendHealth({ env, fetchImpl: down, now: 16_000 });
    expect(down).toHaveBeenCalledTimes(2);
  });

  it("uses an outage reported by a failed session check", async () => {
    markBackendUnhealthy("session refresh failed", 5_000);
    const fetchImpl = respond(200);
    const health = await checkBackendHealth({ env, fetchImpl, now: 6_000 });
    expect(health.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never blocks an unconfigured project", async () => {
    const fetchImpl = respond(500);
    const health = await checkBackendHealth({ env: {}, fetchImpl, now: 1 });
    expect(health.ok).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
