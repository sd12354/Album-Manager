import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/settings-client";
import type { UserSettings } from "@/types";

interface SettingsPageProps {
  searchParams?: Promise<{ ebay_error?: string }>;
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

  return (
    <SettingsClient
      ebayConnected={!!ebayCreds}
      ebayUsername={userSettings.ebay_username ?? "vinyl_collector_pro"}
      ebayEnvironment={userSettings.ebay_environment}
      ebayError={params?.ebay_error}
      discogsEnvTokenConfigured={!!process.env.DISCOGS_PERSONAL_ACCESS_TOKEN}
      userEmail={user?.email ?? ""}
      userSettings={userSettings}
    />
  );
}
