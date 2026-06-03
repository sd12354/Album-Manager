import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/landing-page";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <LandingPage isLoggedIn={!!user} />;
}
