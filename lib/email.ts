/**
 * Email send stubs. No transactional provider is wired up yet — these
 * functions exist so the UI (test email button, future invite emails)
 * compiles and degrades gracefully. When a provider is added, plug it
 * into sendSaleEmail() and emailConfigured() and the surrounding code
 * keeps working unchanged.
 */

export function emailConfigured(): boolean {
  return false;
}

interface SaleEmailInput {
  to: string;
  albumTitle: string;
  albumArtist: string;
  platform: "eBay" | "Discogs" | "Manual";
  soldPrice: number;
  buyerName?: string;
  listingUrl?: string;
  /** If true, prefixes the subject with [TEST] so the user can tell. */
  test?: boolean;
}

export async function sendSaleEmail(
  _input: SaleEmailInput
): Promise<{ ok: false; error: string }> {
  return {
    ok: false,
    error:
      "Email delivery isn't set up on this server yet. Configure a transactional email provider in lib/email.ts to enable.",
  };
}
