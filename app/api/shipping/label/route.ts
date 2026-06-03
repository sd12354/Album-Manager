import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createShippingLabel, type ShippoAddress } from "@/lib/shippo";
import type { Album, UserSettings } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = (user.user_metadata ?? {}) as UserSettings;

  if (!settings.shippo_enabled) {
    return NextResponse.json(
      { error: "Shippo is not enabled. Turn it on in Settings → Shipping." },
      { status: 400 }
    );
  }

  const shippoKey =
    settings.shippo_api_key || process.env.SHIPPO_API_KEY;

  if (!shippoKey) {
    return NextResponse.json(
      { error: "Shippo API key not configured. Add it in Settings → Shipping." },
      { status: 400 }
    );
  }

  const sellerAddress: ShippoAddress | null =
    settings.seller_name && settings.seller_street1 && settings.seller_city
      ? {
          name: settings.seller_name,
          street1: settings.seller_street1,
          street2: settings.seller_street2,
          city: settings.seller_city,
          state: settings.seller_state ?? "",
          zip: settings.seller_zip ?? "",
          country: settings.seller_country ?? "US",
        }
      : null;

  if (!sellerAddress) {
    return NextResponse.json(
      { error: "Seller address not configured. Fill it in Settings → Shipping." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { albumId, buyerAddress } = body as {
    albumId: string;
    buyerAddress?: ShippoAddress;
  };

  if (!albumId) {
    return NextResponse.json({ error: "albumId required" }, { status: 400 });
  }

  const { data: album, error } = await supabase
    .from("albums")
    .select("*")
    .eq("id", albumId)
    .single();

  if (error || !album) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const typedAlbum = album as Album;

  const to: ShippoAddress | null =
    buyerAddress ??
    (typedAlbum.buyer_name && typedAlbum.buyer_address_raw
      ? parseBuyerAddressFromRaw(
          typedAlbum.buyer_name,
          typedAlbum.buyer_address_raw
        )
      : null);

  if (!to) {
    return NextResponse.json(
      {
        error:
          "Buyer address not available. Provide it in the request body as buyerAddress.",
      },
      { status: 400 }
    );
  }

  try {
    const label = await createShippingLabel({
      from: sellerAddress,
      to,
      apiKey: shippoKey,
    });

    await supabase
      .from("albums")
      .update({
        tracking_number: label.trackingNumber,
        shipping_label_url: label.labelUrl,
        shipping_carrier: `${label.carrier} — ${label.serviceLevel}`,
        shipping_rate: label.rate,
        buyer_name: to.name,
        buyer_address_raw: formatAddress(to),
      })
      .eq("id", albumId);

    return NextResponse.json(label);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Label creation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function formatAddress(a: ShippoAddress): string {
  return [a.name, a.street1, a.street2, `${a.city}, ${a.state} ${a.zip}`, a.country]
    .filter(Boolean)
    .join("\n");
}

function parseBuyerAddressFromRaw(
  name: string,
  raw: string
): ShippoAddress | null {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 3) return null;

  const country = lines[lines.length - 1];
  const cityStateZipLine = lines[lines.length - 2];
  const usMatch = cityStateZipLine.match(
    /^(.+?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/
  );

  let city = "";
  let state = "";
  let zip = "";

  if (usMatch) {
    [, city, state, zip] = usMatch;
  } else {
    const intl = cityStateZipLine.match(/^(.+?)\s+([\w\d -]{2,10})$/);
    city = intl ? intl[1].trim() : cityStateZipLine;
    zip = intl ? intl[2].trim() : "";
  }

  const streetLines = lines.slice(1, lines.length - 2);
  const street1 = streetLines[0] ?? "";
  const street2 = streetLines[1];

  if (!street1 || !city) return null;

  return { name, street1, street2, city, state, zip, country };
}
