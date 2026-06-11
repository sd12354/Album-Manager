import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_COLLECTION_COOKIE,
  getAccessibleCollections,
  getActiveCollection,
} from "@/lib/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const collections = await getAccessibleCollections(user);
  const active = await getActiveCollection(user, collections);
  return NextResponse.json({ active, collections });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ownerId } = await request.json().catch(() => ({}));
  if (!ownerId || typeof ownerId !== "string") {
    return NextResponse.json({ error: "ownerId required" }, { status: 400 });
  }

  // Only allow switching to a collection the user can actually access.
  const accessible = await getAccessibleCollections(user);
  if (!accessible.some((c) => c.ownerId === ownerId)) {
    return NextResponse.json(
      { error: "You don't have access to that collection." },
      { status: 403 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_COLLECTION_COOKIE, ownerId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
