import { SupabaseConfigNotice } from "@/components/supabase-config-notice";
import { LoginForm } from "@/components/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/client";

interface LoginPageProps {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseConfigNotice />;
  }

  const params = await searchParams;
  return <LoginForm initialError={params?.error} next={params?.next} />;
}
