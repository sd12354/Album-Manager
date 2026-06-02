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

  return (
    <AppShell userEmail={user?.email} ebayConnected={!!ebayCreds}>
      {children}
    </AppShell>
  );
}
