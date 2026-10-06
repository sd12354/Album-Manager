import { NextResponse } from "next/server";
import { checkBackendHealth, isMaintenanceMode } from "@/lib/backend-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tiny status endpoint the downtime page polls to know when to get out of
 * the way. Deliberately reveals nothing beyond up/down.
 */
export async function GET() {
  const maintenance = isMaintenanceMode(process.env);
  const health = await checkBackendHealth();
  return NextResponse.json(
    { ok: health.ok && !maintenance, maintenance },
    { headers: { "Cache-Control": "no-store" } }
  );
}
