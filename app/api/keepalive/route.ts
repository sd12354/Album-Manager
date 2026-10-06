import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily keep-alive, called by the Vercel cron in vercel.json.
 *
 * Supabase pauses free-plan projects after a week without activity, which
 * takes sign-in and the whole catalogue offline until someone resumes the
 * project by hand. One small real database read a day keeps the project
 * counted as active. It returns only a yes/no, never any data.
 *
 * If CRON_SECRET is set, Vercel sends it as a bearer token and anything else
 * is turned away; without it the endpoint is open but harmless.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = await createServiceClient();
    const { error } = await admin.from("albums").select("id").limit(1);
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { ok: true, at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
