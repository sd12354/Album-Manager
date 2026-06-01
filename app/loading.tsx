import { VinylSpinner } from "@/components/vinyl-spinner";

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base">
      <VinylSpinner size="xl" label="Loading VinylVault..." />
    </div>
  );
}
