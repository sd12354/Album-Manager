import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // People I've granted access to (my collection).
  const { data: members, error: membersError } = await supabase
    .from("collection_members")
    .select("id, member_id, member_email, role, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });
  if (membersError) {
    return NextResponse.json(
      { error: `Could not load collection members: ${membersError.message}` },
      { status: 500 }
    );
  }

  // Invites I've sent that haven't been claimed yet.
  const { data: invites, error: invitesError } = await supabase
    .from("collection_invites")
    .select("id, email, role, status, created_at")
    .eq("owner_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (invitesError) {
    return NextResponse.json(
      { error: `Could not load collection invites: ${invitesError.message}` },
      { status: 500 }
    );
  }

  // Collections shared with me.
  const { data: sharedWithMe, error: sharedWithMeError } = await supabase
    .from("collection_members")
    .select("id, owner_id, owner_email, role, created_at")
    .eq("member_id", user.id)
    .order("created_at", { ascending: true });
  if (sharedWithMeError) {
    return NextResponse.json(
      { error: `Could not load shared collections: ${sharedWithMeError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    members: members ?? [],
    invites: invites ?? [],
    sharedWithMe: sharedWithMe ?? [],
  });
}
