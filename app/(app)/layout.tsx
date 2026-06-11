import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import {
  claimPendingInvites,
  getAccessibleCollections,
  getActiveCollection,
} from "@/lib/collections";

type DiscogsMeta = {
  discogs_token?: string;
  discogs_oauth_token?: string;
  discogs_oauth_token_secret?: string;
};

function discogsConnectedFromMeta(meta: DiscogsMeta): boolean {
  return !!(
    (meta.discogs_oauth_token && meta.discogs_oauth_token_secret) ||
    meta.discogs_token ||
    process.env.DISCOGS_PERSONAL_ACCESS_TOKEN
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Turn any invites addressed to this user's email into memberships.
  if (user) {
    await claimPendingInvites(user).catch(() => 0);
  }

  const collections = user ? await getAccessibleCollections(user) : [];
  const active =
    user && collections.length > 0
      ? await getActiveCollection(user, collections)
      : null;
  const activeOwnerId = active?.ownerId ?? user?.id ?? "";

  // Connection status reflects whoever owns the active collection.
  let ebayConnected = false;
  let discogsConnected = false;

  if (active?.isOwner) {
    const { data: ebayCreds } = await supabase
      .from("ebay_credentials")
      .select("user_id")
      .eq("user_id", user?.id ?? "")
      .maybeSingle();
    ebayConnected = !!ebayCreds;
    discogsConnected = discogsConnectedFromMeta(
      (user?.user_metadata ?? {}) as DiscogsMeta
    );
  } else if (active) {
    // Shared collection: read the owner's connection status via service role.
    try {
      const admin = await createServiceClient();
      const { data: ebayCreds } = await admin
        .from("ebay_credentials")
        .select("user_id")
        .eq("user_id", active.ownerId)
        .maybeSingle();
      ebayConnected = !!ebayCreds;
      const { data: ownerData } = await admin.auth.admin.getUserById(
        active.ownerId
      );
      discogsConnected = discogsConnectedFromMeta(
        (ownerData?.user?.user_metadata ?? {}) as DiscogsMeta
      );
    } catch {
      // Leave both false if the lookup fails.
    }
  }

  return (
    <AppShell
      userEmail={user?.email}
      ebayConnected={ebayConnected}
      discogsConnected={discogsConnected}
      collections={collections}
      activeOwnerId={activeOwnerId}
    >
      {children}
    </AppShell>
  );
}
