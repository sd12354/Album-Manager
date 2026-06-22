import { Resend } from "resend";

let cached: Resend | null = null;

function client(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!cached) cached = new Resend(process.env.RESEND_API_KEY);
  return cached;
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
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

export async function sendSaleEmail(input: SaleEmailInput) {
  const resend = client();
  if (!resend) {
    return { ok: false as const, error: "RESEND_API_KEY is not configured." };
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "VinylVault <onboarding@resend.dev>";
  const subjectPrefix = input.test ? "[TEST] " : "";
  const subject = `${subjectPrefix}Sold on ${input.platform}: ${input.albumTitle}`;

  const priceFmt = `$${input.soldPrice.toFixed(2)}`;
  const lines = [
    `<h2 style="margin:0 0 12px;font-family:system-ui,sans-serif">${input.test ? "Test sale notification" : "An album sold"}</h2>`,
    `<p style="margin:0 0 8px;font-family:system-ui,sans-serif"><strong>${escapeHtml(input.albumTitle)}</strong> &mdash; ${escapeHtml(input.albumArtist)}</p>`,
    `<p style="margin:0 0 8px;font-family:system-ui,sans-serif">Platform: ${input.platform}</p>`,
    `<p style="margin:0 0 8px;font-family:system-ui,sans-serif">Sold price: <strong>${priceFmt}</strong></p>`,
    input.buyerName ? `<p style="margin:0 0 8px;font-family:system-ui,sans-serif">Buyer: ${escapeHtml(input.buyerName)}</p>` : "",
    input.listingUrl && isSafeHttpUrl(input.listingUrl)
      ? `<p style="margin:0 0 8px;font-family:system-ui,sans-serif"><a href="${escapeHtml(input.listingUrl)}">View original listing</a></p>`
      : "",
    input.test ? `<p style="margin:16px 0 0;font-family:system-ui,sans-serif;color:#888;font-size:12px">This is a test email triggered from Settings → Notifications.</p>` : "",
  ].filter(Boolean);

  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject,
    html: lines.join(""),
  });

  if (error) {
    return { ok: false as const, error: error.message ?? "Resend error" };
  }
  return { ok: true as const };
}

interface InviteEmailInput {
  to: string;
  ownerEmail: string;
  role: "viewer" | "editor";
  /** True when the invitee already has an account and has been granted access. */
  immediate: boolean;
  /** Sign-up URL — only shown when immediate=false. */
  signupUrl: string;
}

export async function sendCollectionInviteEmail(input: InviteEmailInput) {
  const resend = client();
  if (!resend) {
    return { ok: false as const, error: "RESEND_API_KEY is not configured." };
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "VinylVault <onboarding@resend.dev>";
  const owner = escapeHtml(input.ownerEmail);
  const subject = input.immediate
    ? `${input.ownerEmail} added you to their VinylVault collection`
    : `${input.ownerEmail} invited you to their VinylVault collection`;

  const body = input.immediate
    ? [
        `<h2 style="margin:0 0 12px;font-family:system-ui,sans-serif">You have access to ${owner}'s collection</h2>`,
        `<p style="margin:0 0 8px;font-family:system-ui,sans-serif">You've been added as a <strong>${input.role}</strong> on VinylVault.</p>`,
        `<p style="margin:0 0 8px;font-family:system-ui,sans-serif">${input.role === "editor" ? "You can add, edit, price, and photograph albums." : "You'll be able to browse the catalogue in read-only mode."} Marketplace listing and shipping stay with the owner.</p>`,
        `<p style="margin:16px 0 0;font-family:system-ui,sans-serif">Open VinylVault and you'll find ${owner}'s collection in the switcher at the top of the sidebar.</p>`,
      ]
    : [
        `<h2 style="margin:0 0 12px;font-family:system-ui,sans-serif">You've been invited to ${owner}'s collection</h2>`,
        `<p style="margin:0 0 8px;font-family:system-ui,sans-serif">${owner} invited you as a <strong>${input.role}</strong> on VinylVault.</p>`,
        `<p style="margin:0 0 8px;font-family:system-ui,sans-serif">Sign up with this email address to claim access:</p>`,
        isSafeHttpUrl(input.signupUrl)
          ? `<p style="margin:16px 0;font-family:system-ui,sans-serif"><a href="${escapeHtml(input.signupUrl)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#7c3aed;color:#fff;text-decoration:none;font-weight:500">Create your account</a></p>`
          : "",
        `<p style="margin:16px 0 0;font-family:system-ui,sans-serif;color:#888;font-size:12px">If you didn't expect this invite, you can ignore this email.</p>`,
      ];

  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject,
    html: body.filter(Boolean).join(""),
  });

  if (error) {
    return { ok: false as const, error: error.message ?? "Resend error" };
  }
  return { ok: true as const };
}

function isSafeHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
