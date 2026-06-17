import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AppNotification } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 30;
const MAX_EACH = 12;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const notifications: AppNotification[] = [];

  const { data: soldAlbums } = await supabase
    .from("albums")
    .select("id, title, artist, sold_price, sold_at")
    .eq("user_id", user.id)
    .eq("status", "sold")
    .not("sold_at", "is", null)
    .gte("sold_at", since)
    .order("sold_at", { ascending: false })
    .limit(MAX_EACH);

  for (const album of soldAlbums ?? []) {
    if (!album.sold_at) continue;
    const price =
      album.sold_price != null
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(album.sold_price)
        : null;
    notifications.push({
      id: `sale-${album.id}`,
      type: "album_sold",
      title: `${album.title} sold`,
      message: price
        ? `${album.artist} · ${price}`
        : album.artist ?? "Album marked as sold",
      href: `/albums/${album.id}`,
      createdAt: album.sold_at,
    });
  }

  if (user.email) {
    const { data: pendingInvites } = await supabase
      .from("collection_invites")
      .select("id, owner_email, role, created_at")
      .eq("status", "pending")
      .ilike("email", user.email)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_EACH);

    for (const invite of pendingInvites ?? []) {
      const owner =
        (invite.owner_email as string) || "A collector";
      notifications.push({
        id: `invite-${invite.id}`,
        type: "collection_invite",
        title: "Collection invitation",
        message: `${owner} invited you as ${invite.role ?? "viewer"}`,
        href: "/settings",
        createdAt: invite.created_at as string,
      });
    }
  }

  const { data: sharedWithMe } = await supabase
    .from("collection_members")
    .select("id, owner_email, role, created_at")
    .eq("member_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_EACH);

  for (const row of sharedWithMe ?? []) {
    const owner = (row.owner_email as string) || "A collector";
    notifications.push({
      id: `shared-${row.id}`,
      type: "collection_shared",
      title: "Collection shared with you",
      message: `You can ${row.role === "editor" ? "edit" : "view"} ${owner}'s catalogue`,
      href: "/albums",
      createdAt: row.created_at as string,
    });
  }

  const { data: newMembers } = await supabase
    .from("collection_members")
    .select("id, member_email, role, created_at")
    .eq("owner_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_EACH);

  for (const row of newMembers ?? []) {
    const who = (row.member_email as string) || "Someone";
    notifications.push({
      id: `member-${row.id}`,
      type: "collaborator_joined",
      title: "New collaborator",
      message: `${who} joined as ${row.role ?? "viewer"}`,
      href: "/settings",
      createdAt: row.created_at as string,
    });
  }

  notifications.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({
    notifications: notifications.slice(0, 25),
  });
}
