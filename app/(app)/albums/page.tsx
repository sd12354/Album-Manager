import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CatalogueClient } from "@/components/catalogue-client";
import { VinylSpinner } from "@/components/vinyl-spinner";
import { canManage, getActiveCollection } from "@/lib/collections";
import type { Album } from "@/types";

export default async function AlbumsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const active = user ? await getActiveCollection(user) : null;
  const ownerId = active?.ownerId ?? user?.id ?? "";
  const canEdit = canManage(active?.role ?? "owner");

  // Scope to the active collection's owner so own + shared albums don't mix.
  const { data: albums } = await supabase
    .from("albums")
    .select("*")
    .eq("user_id", ownerId)
    .order("title", { ascending: true });

  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <VinylSpinner size="lg" label="Loading catalogue..." />
        </div>
      }
    >
      <CatalogueClient
        albums={(albums ?? []) as Album[]}
        canEdit={canEdit}
        isOwner={active?.isOwner ?? true}
        ownerId={ownerId}
        collectionLabel={active && !active.isOwner ? active.label : undefined}
      />
    </Suspense>
  );
}
