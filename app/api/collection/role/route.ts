import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CollectionRole } from "@/types";

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
  const memberId = body.memberId as string | undefined;
  const role: CollectionRole = body.role === "editor" ? "editor" : "viewer";
  if (!memberId) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }

  // RLS ensures only the owner can update rows in their collection.
  const { data, error } = await supabase
    .from("collection_members")
    .update({ role })
    .eq("owner_id", user.id)
    .eq("member_id", memberId)
    .select("member_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Collaborator not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
