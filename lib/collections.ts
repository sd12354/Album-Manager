import "server-only";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type {
  AccessibleCollection,
  CollectionMember,
  CollectionRole,
} from "@/types";

export const ACTIVE_COLLECTION_COOKIE = "vv_active_collection";

export function canManage(role: CollectionRole | "owner" | null): boolean {
  return role === "owner" || role === "editor";
}

/**
 * Resolves the active collection for an API route: the authenticated user, the
 * owner whose collection is active, the user's role in it, and whether they can
 * make changes. Returns null when unauthenticated.
 */
export async function getActiveContext(): Promise<{
  user: User;
  ownerId: string;
  role: CollectionRole | "owner";
  canEdit: boolean;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const active = await getActiveCollection(user);
  return {
    user,
    ownerId: active.ownerId,
    role: active.role,
    canEdit: canManage(active.role),
  };
}

/**
 * Returns auth metadata for the active collection owner. Shared collection
 * workflows should use the owner's marketplace integrations, not the acting
 * member's integrations.
 */
export async function getActiveOwnerMetadata(ctx: {
  user: User;
  ownerId: string;
}): Promise<Record<string, unknown>> {
  if (ctx.ownerId === ctx.user.id) {
    return (ctx.user.user_metadata ?? {}) as Record<string, unknown>;
  }

  try {
    const admin = await createServiceClient();
    const { data } = await admin.auth.admin.getUserById(ctx.ownerId);
    return (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Collections the user can act in: their own first, then any shared with them.
 */
export async function getAccessibleCollections(
  user: User
): Promise<AccessibleCollection[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("collection_members")
    .select("owner_id, owner_email, role")
    .eq("member_id", user.id);

  const self: AccessibleCollection = {
    ownerId: user.id,
    ownerEmail: user.email ?? "",
    role: "owner",
    isOwner: true,
    label: "My Collection",
  };

  const shared: AccessibleCollection[] = (data ?? []).map((row) => ({
    ownerId: row.owner_id as string,
    ownerEmail: (row.owner_email as string) ?? "Shared collection",
    role: (row.role as CollectionRole) ?? "viewer",
    isOwner: false,
    label: (row.owner_email as string) ?? "Shared collection",
  }));

  return [self, ...shared];
}

/**
 * Resolves which collection the user is currently viewing from the cookie,
 * falling back to their own collection when unset or no longer accessible.
 */
export async function getActiveCollection(
  user: User,
  accessible?: AccessibleCollection[]
): Promise<AccessibleCollection> {
  const list = accessible ?? (await getAccessibleCollections(user));
  const cookieStore = await cookies();
  const desired = cookieStore.get(ACTIVE_COLLECTION_COOKIE)?.value;
  const match = desired ? list.find((c) => c.ownerId === desired) : undefined;
  return match ?? list[0];
}

/**
 * The current user's role for a given collection owner: "owner" for their own
 * collection, the membership role for a shared one, or null with no access.
 */
export async function getRoleForOwner(
  user: User,
  ownerId: string
): Promise<CollectionRole | "owner" | null> {
  if (ownerId === user.id) return "owner";
  const supabase = await createClient();
  const { data } = await supabase
    .from("collection_members")
    .select("role")
    .eq("owner_id", ownerId)
    .eq("member_id", user.id)
    .maybeSingle();
  return (data?.role as CollectionRole) ?? null;
}

/**
 * Converts any pending invites addressed to the user's email into memberships.
 * Runs with the service role so it can read invites across owners and write the
 * membership rows. Safe to call on every authenticated page load.
 */
export async function claimPendingInvites(user: User): Promise<number> {
  if (!user.email) return 0;
  const admin = await createServiceClient();

  const { data: invites } = await admin
    .from("collection_invites")
    .select("*")
    .eq("status", "pending")
    .ilike("email", user.email);

  if (!invites || invites.length === 0) return 0;

  let claimed = 0;
  for (const invite of invites) {
    const { error } = await admin.from("collection_members").upsert(
      {
        owner_id: invite.owner_id,
        owner_email: invite.owner_email,
        member_id: user.id,
        member_email: user.email,
        role: invite.role,
      } as Partial<CollectionMember>,
      { onConflict: "owner_id,member_id" }
    );
    if (!error) {
      await admin
        .from("collection_invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", invite.id);
      claimed += 1;
    }
  }
  return claimed;
}
