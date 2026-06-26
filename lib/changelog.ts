export interface ChangelogEntry {
  /** ISO date (YYYY-MM-DD) — used for sort + display. */
  date: string;
  /** Semver string for this release. Surfaced in Settings → About. */
  version?: string;
  title: string;
  items: string[];
}

/**
 * Newest entries first. Add new releases at the top. The dashboard surfaces
 * the most recent 2 entries; a future /changelog page can show the full list.
 *
 * The first entry's `version` is the canonical current product version. Bump
 * package.json's "version" in tandem so APP_VERSION (in lib/version.ts)
 * matches what users see in the dashboard "What's new" card.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-06-25",
    version: "0.5.0",
    title: "Mobile, ownership & polish",
    items: [
      "Site is now mobile-friendly — catalogue, dashboard, settings, and album pages all reflow for phones.",
      "Transfer collection ownership to an existing collaborator from Settings → Collaborators.",
      "Download cover photos individually or all at once as a ZIP — handy for manual eBay/Discogs listings.",
      "Settings now shows the current app version + a link to the full release notes.",
      "Lightbox close button is bigger and always reachable.",
    ],
  },
  {
    date: "2026-06-24",
    version: "0.4.0",
    title: "Faster everywhere, leaner storage",
    items: [
      "Dashboard loads instantly even with 1,500+ albums (single-trip query + parallel pagination).",
      "Catalogue cover thumbnails are 20-100× smaller — first paint is much faster.",
      "Supabase egress cut by ~80% via aggressive Vercel image caching — keeps you on the free tier longer.",
      "Loading skeletons now visible in light mode (they were invisible white-on-white).",
    ],
  },
  {
    date: "2026-06-23",
    version: "0.3.0",
    title: "Search, filter, organize",
    items: [
      "Genre filter on the catalogue, with counts per genre.",
      "Duplicates filter — spot and clean up records you imported twice.",
      "Filter toolbar redesigned: prominent search up top, active filters highlighted, one-click Reset.",
      "Filters persist when you click into an album and back — never lose your view again.",
      "When AI can't read a cover photo, manually pick the album from a searchable dropdown instead of losing the upload.",
      "AI-Price button on the catalogue for nuanced bulk pricing on any selection.",
    ],
  },
  {
    date: "2026-06-22",
    version: "0.2.0",
    title: "Manual listings & cleaner settings",
    items: [
      "Track a listing you posted yourself on eBay or Discogs from the album page — no API call, just a URL + price.",
      "Shippo removed; buyer addresses still captured on every sale so you can ship with any carrier.",
      "eBay and Discogs status now visible in Settings without expanding the section.",
    ],
  },
  {
    date: "2026-06-15",
    version: "0.1.0",
    title: "Photo coverage at a glance",
    items: [
      "New dashboard card shows how many albums have cover photos and how many are missing.",
      "Catalogue gets a Photos filter (with / missing / all) so you can jump straight to the gaps.",
    ],
  },
];
