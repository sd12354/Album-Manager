import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

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
    <div className="min-h-screen bg-base">
      <Sidebar
        userEmail={user?.email}
        ebayConnected={!!ebayCreds}
      />
      <main className="ml-60 min-h-screen p-8">{children}</main>
    </div>
  );
}
