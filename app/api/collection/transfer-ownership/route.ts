import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Transfer the caller's collection (every album they own) to one of their
 * existing collaborators. The recipient becomes the owner; the previous
 * owner is downgraded to an editor of the now-shared collection so they
 * keep edit access. Marketplace (eBay/Discogs) OAuth credentials are tied
 * to the user account and do NOT transfer — the new owner re-connects
 * their own credentials to list/delist via VinylVault going forward.
 *
 * All the actual work happens inside the SECURITY DEFINER RPC
 * `public.transfer_collection_ownership` so the operation is atomic and
 * the trigger-bypass session flag is scoped to the transaction.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const newOwnerId =
    typeof body?.newOwnerId === "string" ? body.newOwnerId : undefined;
  if (!newOwnerId) {
    return NextResponse.json(
      { error: "newOwnerId required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc(
    "transfer_collection_ownership",
    { new_owner_id: newOwnerId }
  );

  if (error) {
    // 403 for permission failures (validation inside the RPC raises 42501),
    // 400 for "you cannot transfer to yourself" (22023). Everything else is
    // a 500.
    const code = (error as { code?: string }).code;
    const status =
      code === "42501" ? 403 : code === "22023" ? 400 : 500;
    return NextResponse.json(
      { error: error.message ?? "Transfer failed" },
      { status }
    );
  }

  return NextResponse.json(data);
}
