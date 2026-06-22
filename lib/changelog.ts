export interface ChangelogEntry {
  /** ISO date (YYYY-MM-DD) — used for sort + display. */
  date: string;
  title: string;
  items: string[];
}

/**
 * Newest entries first. Add new releases at the top. The dashboard surfaces
 * the most recent 2 entries; a future /changelog page can show the full list.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-06-22",
    title: "Manual listings, test email & cleaner settings",
    items: [
      "Track a listing you posted yourself on eBay or Discogs from the album page — no API call, just a URL + price.",
      "Send a test sale email from Settings → Notifications to verify delivery.",
      "Shippo removed; buyer addresses still captured on every sale so you can ship with any carrier.",
      "eBay and Discogs status now visible in Settings without expanding the section.",
    ],
  },
  {
    date: "2026-06-15",
    title: "Photo coverage at a glance",
    items: [
      "New dashboard card shows how many albums have cover photos and how many are missing.",
      "Catalogue gets a Photos filter (with / missing / all) so you can jump straight to the gaps.",
    ],
  },
];
