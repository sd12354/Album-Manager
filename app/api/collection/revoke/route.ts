import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { memberId, inviteId, leaveOwnerId } = body as {
    memberId?: string;
    inviteId?: string;
    leaveOwnerId?: string;
  };

  // Owner removes a collaborator from their collection.
  if (memberId) {
    const { error } = await supabase
      .from("collection_members")
      .delete()
      .eq("owner_id", user.id)
      .eq("member_id", memberId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Owner cancels a pending invite (service role to also clear it cleanly).
  if (inviteId) {
    const admin = await createServiceClient();
    const { error } = await admin
      .from("collection_invites")
      .delete()
      .eq("id", inviteId)
      .eq("owner_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Member leaves a collection shared with them.
  if (leaveOwnerId) {
    const { error } = await supabase
      .from("collection_members")
      .delete()
      .eq("owner_id", leaveOwnerId)
      .eq("member_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to do" }, { status: 400 });
}
