export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base p-4">
      {!hasSupabaseConfig && (
        <div className="mb-4 max-w-md rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          Supabase environment variables are not set. Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then
          redeploy before signing in.
        </div>
      )}
      {children}
    </div>
  );
}
