import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CatalogueClient } from "@/components/catalogue-client";
import { VinylSpinner } from "@/components/vinyl-spinner";
import type { Album } from "@/types";

export default async function AlbumsPage() {
  const supabase = await createClient();
  const { data: albums } = await supabase
    .from("albums")
    .select("*")
    .order("title", { ascending: true });

  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <VinylSpinner size="lg" label="Loading catalogue..." />
        </div>
      }
    >
      <CatalogueClient albums={(albums ?? []) as Album[]} />
    </Suspense>
  );
}
