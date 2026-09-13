import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import {
  claimPendingInvites,
  getAccessibleCollections,
  getActiveCollection,
  getOwnerConnectionStatus,
} from "@/lib/collections";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Turn any invites addressed to this user's email into memberships.
  await claimPendingInvites(user).catch(() => 0);

  const collections = await getAccessibleCollections(user);
  const active =
    collections.length > 0
      ? await getActiveCollection(user, collections)
      : null;
  const activeOwnerId = active?.ownerId ?? user.id;

  // Connection status reflects whoever owns the active collection.
  let ebayConnected = false;
  let discogsConnected = false;

  if (active) {
    const status = await getOwnerConnectionStatus(user, active.ownerId);
    ebayConnected = status.ebayConnected;
    discogsConnected = status.discogsConnected;
  }

  return (
    <AppShell
      userEmail={user.email}
      ebayConnected={ebayConnected}
      discogsConnected={discogsConnected}
      collections={collections}
      activeOwnerId={activeOwnerId}
    >
      {children}
    </AppShell>
  );
}
