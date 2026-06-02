const SHIPPO_BASE = "https://api.goshippo.com";

export interface ShippoAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

// Standard 12" LP in a padded record mailer
export const VINYL_LP_PARCEL = {
  length: "14",
  width: "14",
  height: "1.5",
  distance_unit: "in",
  weight: "1",
  mass_unit: "lb",
} as const;

export interface ShippoLabelResult {
  trackingNumber: string;
  labelUrl: string;
  carrier: string;
  serviceLevel: string;
  rate: number;
  currency: string;
  trackingUrl?: string;
  estimatedDays?: number;
}

interface ShippoRate {
  object_id: string;
  servicelevel: { token: string; name: string };
  amount: string;
  currency: string;
  provider: string;
  estimated_days?: number;
}

interface ShippoShipment {
  object_id: string;
  status: string;
  rates: ShippoRate[];
  messages?: Array<{ source: string; text: string }>;
}

interface ShippoTransaction {
  object_id: string;
  status: string;
  tracking_number: string;
  label_url: string;
  tracking_url_provider?: string;
  messages?: Array<{ source: string; code: string; text: string }>;
}

async function shippoFetch<T>(
  path: string,
  apiKey: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${SHIPPO_BASE}${path}`, {
    method: body !== undefined ? "POST" : "GET",
    headers: {
      Authorization: `ShippoToken ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shippo ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export async function createShippingLabel(params: {
  from: ShippoAddress;
  to: ShippoAddress;
  apiKey: string;
}): Promise<ShippoLabelResult> {
  // Step 1 — create shipment and get rates synchronously
  const shipment = await shippoFetch<ShippoShipment>("/shipments/", params.apiKey, {
    address_from: {
      name: params.from.name,
      street1: params.from.street1,
      street2: params.from.street2 ?? "",
      city: params.from.city,
      state: params.from.state,
      zip: params.from.zip,
      country: params.from.country || "US",
      phone: params.from.phone ?? "",
      email: params.from.email ?? "",
    },
    address_to: {
      name: params.to.name,
      street1: params.to.street1,
      street2: params.to.street2 ?? "",
      city: params.to.city,
      state: params.to.state,
      zip: params.to.zip,
      country: params.to.country || "US",
      phone: params.to.phone ?? "",
      email: params.to.email ?? "",
    },
    parcels: [VINYL_LP_PARCEL],
    async: false,
  });

  const rates = shipment.rates ?? [];
  if (rates.length === 0) {
    throw new Error(
      "No shipping rates returned by Shippo. Check that both addresses are valid and complete."
    );
  }

  // Step 2 — pick rate: USPS Media Mail first (cheapest for vinyl/books),
  // then cheapest available
  const mediaMailRate = rates.find(
    (r) =>
      r.servicelevel.token.includes("media_mail") ||
      r.servicelevel.name.toLowerCase().includes("media mail")
  );
  const cheapestRate = [...rates].sort(
    (a, b) => parseFloat(a.amount) - parseFloat(b.amount)
  )[0];
  const chosenRate = mediaMailRate ?? cheapestRate;

  // Step 3 — purchase the label
  const transaction = await shippoFetch<ShippoTransaction>(
    "/transactions/",
    params.apiKey,
    {
      rate: chosenRate.object_id,
      label_file_type: "PDF",
      async: false,
    }
  );

  if (transaction.status !== "SUCCESS") {
    const msg =
      transaction.messages?.[0]?.text ??
      `Label purchase failed (status: ${transaction.status})`;
    throw new Error(msg);
  }

  if (!transaction.tracking_number || !transaction.label_url) {
    throw new Error("Shippo returned a SUCCESS status but no tracking number or label URL.");
  }

  return {
    trackingNumber: transaction.tracking_number,
    labelUrl: transaction.label_url,
    carrier: chosenRate.provider,
    serviceLevel: chosenRate.servicelevel.name,
    rate: parseFloat(chosenRate.amount),
    currency: chosenRate.currency,
    trackingUrl: transaction.tracking_url_provider,
    estimatedDays: chosenRate.estimated_days,
  };
}

export async function validateShippoKey(apiKey: string): Promise<boolean> {
  try {
    await shippoFetch("/carrier_accounts/", apiKey);
    return true;
  } catch {
    return false;
  }
}
