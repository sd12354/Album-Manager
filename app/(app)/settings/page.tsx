import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/settings-client";
import type { UserSettings } from "@/types";

interface SettingsPageProps {
  searchParams?: Promise<{
    ebay_error?: string;
    discogs?: string;
    discogs_error?: string;
    shippo?: string;
    shippo_error?: string;
  }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ebayCreds } = await supabase
    .from("ebay_credentials")
    .select("*")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const userSettings = (user?.user_metadata ?? {}) as UserSettings;

  const discogsConnectedViaOAuth = !!(
    userSettings.discogs_oauth_token && userSettings.discogs_oauth_token_secret
  );
  const discogsOAuthConfigured = !!(
    process.env.DISCOGS_CONSUMER_KEY && process.env.DISCOGS_CONSUMER_SECRET
  );

  const shippoConnectedViaOAuth = !!userSettings.shippo_oauth_token;
  const shippoOAuthConfigured = !!(
    process.env.SHIPPO_CLIENT_ID && process.env.SHIPPO_CLIENT_SECRET
  );

  return (
    <SettingsClient
      ebayConnected={!!ebayCreds}
      ebayUsername={userSettings.ebay_username ?? "vinyl_collector_pro"}
      ebayEnvironment={userSettings.ebay_environment}
      ebayError={params?.ebay_error}
      discogsEnvTokenConfigured={!!process.env.DISCOGS_PERSONAL_ACCESS_TOKEN}
      discogsConnectedViaOAuth={discogsConnectedViaOAuth}
      discogsUsername={userSettings.discogs_username}
      discogsOAuthConfigured={discogsOAuthConfigured}
      discogsConnectedNotice={params?.discogs}
      discogsError={params?.discogs_error}
      shippoConnectedViaOAuth={shippoConnectedViaOAuth}
      shippoOAuthConfigured={shippoOAuthConfigured}
      shippoAccountLabel={userSettings.shippo_account_label}
      shippoConnectedNotice={params?.shippo}
      shippoError={params?.shippo_error}
      userEmail={user?.email ?? ""}
      userSettings={userSettings}
    />
  );
}
