import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ebayCreds } = await supabase
    .from("ebay_credentials")
    .select("user_id")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const userMeta = (user?.user_metadata ?? {}) as {
    discogs_token?: string;
    discogs_oauth_token?: string;
    discogs_oauth_token_secret?: string;
  };
  const discogsConnected = !!(
    (userMeta.discogs_oauth_token && userMeta.discogs_oauth_token_secret) ||
    userMeta.discogs_token ||
    process.env.DISCOGS_PERSONAL_ACCESS_TOKEN
  );

  return (
    <AppShell
      userEmail={user?.email}
      ebayConnected={!!ebayCreds}
      discogsConnected={discogsConnected}
    >
      {children}
    </AppShell>
  );
}
