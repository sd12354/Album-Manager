import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Auth state is per-request, so this page should never be cached or
// prerendered at build time.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
