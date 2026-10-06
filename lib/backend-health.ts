/**
 * Decides when visitors should see the downtime page instead of the app.
 *
 * Two triggers:
 *  1. Planned work: MAINTENANCE_MODE is switched on in the environment.
 *  2. Unplanned outage: the Supabase backend is unreachable, paused, or
 *     restricted. Without this, people land on a login form that fails with a
 *     bare "Failed to fetch".
 *
 * No Next.js imports here, so the request proxy can use it and vitest can
 * exercise it directly.
 */

type Env = Record<string, string | undefined>;

const TRUTHY = new Set(["1", "true", "on", "yes"]);

/** Planned-maintenance switch (MAINTENANCE_MODE=1 / true / on / yes). */
export function isMaintenanceMode(env: Env): boolean {
  return TRUTHY.has((env.MAINTENANCE_MODE ?? "").trim().toLowerCase());
}

/**
 * Accounts listed in MAINTENANCE_ALLOW_EMAILS (comma separated) keep full
 * access while the maintenance page is up, so the work can be checked live.
 */
export function maintenanceAllowsEmail(
  email: string | null | undefined,
  env: Env
): boolean {
  if (!email) return false;
  const allowed = (env.MAINTENANCE_ALLOW_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

/** HTTP statuses that mean "the backend is down", not "the request was wrong". */
export function isOutageStatus(status: number): boolean {
  // 402: Supabase fair-use restriction. 5xx incl. 540 (project paused).
  return status === 402 || status >= 500;
}

/**
 * True when a Supabase auth error says the backend could not be reached at
 * all, as opposed to "nobody is signed in" or "wrong password".
 */
export function isBackendOutageError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: unknown; status?: unknown };
  if (e.name === "AuthRetryableFetchError") return true;
  return typeof e.status === "number" && isOutageStatus(e.status);
}

export interface BackendHealth {
  ok: boolean;
  checkedAt: number;
  reason: string;
}

const HEALTHY_TTL_MS = 60_000;
const UNHEALTHY_TTL_MS = 15_000;

let cached: BackendHealth | null = null;

export function resetBackendHealthCache(): void {
  cached = null;
}

/** Record an outage seen elsewhere (e.g. a failed session refresh). */
export function markBackendUnhealthy(reason: string, now = Date.now()): void {
  cached = { ok: false, checkedAt: now, reason };
}

export interface HealthCheckOptions {
  env?: Env;
  fetchImpl?: typeof fetch;
  now?: number;
  timeoutMs?: number;
}

/**
 * Probe the Supabase auth health endpoint. Results are cached briefly per
 * server instance (longer when healthy) so this adds at most one tiny request
 * a minute. An unconfigured project reports healthy: there is nothing to judge.
 */
export async function checkBackendHealth(
  options: HealthCheckOptions = {}
): Promise<BackendHealth> {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now();
  const doFetch = options.fetchImpl ?? fetch;

  if (cached) {
    const ttl = cached.ok ? HEALTHY_TTL_MS : UNHEALTHY_TTL_MS;
    if (now - cached.checkedAt < ttl) return cached;
  }

  const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !key || url.includes("placeholder.supabase.co")) {
    return { ok: true, checkedAt: now, reason: "unconfigured" };
  }

  let result: BackendHealth;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 3500);
  try {
    const res = await doFetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: controller.signal,
    });
    result = isOutageStatus(res.status)
      ? { ok: false, checkedAt: now, reason: `status ${res.status}` }
      : { ok: true, checkedAt: now, reason: `status ${res.status}` };
  } catch {
    result = {
      ok: false,
      checkedAt: now,
      reason: controller.signal.aborted ? "timeout" : "unreachable",
    };
  } finally {
    clearTimeout(timer);
  }

  cached = result;
  return result;
}

/** Paths that must keep working while the downtime page is showing. */
export function isDowntimeExemptPath(pathname: string): boolean {
  return (
    pathname === "/maintenance" ||
    pathname === "/api/health" ||
    pathname === "/api/keepalive" ||
    // eBay's marketplace-account-deletion notifications must always get an
    // answer, or eBay flags the developer keyset as non-compliant.
    pathname === "/api/ebay/account-deletion"
  );
}
