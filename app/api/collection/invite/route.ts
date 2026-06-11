import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { CollectionRole } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Best-effort lookup of an existing user by email via the admin API. */
async function findUserByEmail(
  admin: Awaited<ReturnType<typeof createServiceClient>>,
  email: string
): Promise<{ id: string; email: string } | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || !data?.users?.length) break;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return { id: match.id, email: match.email ?? email };
    if (data.users.length < 200) break;
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const email = (body.email ?? "").trim().toLowerCase();
  const role: CollectionRole = body.role === "editor" ? "editor" : "viewer";

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }
  if (email === user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "You already own this collection." },
      { status: 400 }
    );
  }

  const admin = await createServiceClient();
  const existing = await findUserByEmail(admin, email);

  // If the invitee already has an account, grant access immediately.
  if (existing) {
    const { error } = await admin.from("collection_members").upsert(
      {
        owner_id: user.id,
        owner_email: user.email,
        member_id: existing.id,
        member_email: existing.email,
        role,
      },
      { onConflict: "owner_id,member_id" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: "added" });
  }

  // Otherwise record a pending invite, claimed when they first sign in.
  const { error } = await admin.from("collection_invites").upsert(
    {
      owner_id: user.id,
      owner_email: user.email,
      email,
      role,
      status: "pending",
      invited_by: user.id,
    },
    { onConflict: "owner_id,email" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: "invited" });
}
