"use client";

import {
  BookOpen,
  Disc2,
  DollarSign,
  ExternalLink,
  Image as ImageIcon,
  Package,
  ShoppingBag,
  Tag,
  Upload,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface HelpPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Small colored status chip mirroring the catalogue status badges. */
function StatusChip({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

export function HelpPanel({ open, onOpenChange }: HelpPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Disc2 className="h-5 w-5 text-accent" />
            VinylVault Guide
          </SheetTitle>
          <SheetDescription>
            How everything works — statuses, pricing, listing, and selling
            explained in depth.
          </SheetDescription>
        </SheetHeader>

        {/* Full guide link — the in-app accordions below cover the most-used
            flows; the linked Google Doc is the deep reference. */}
        <a
          href="https://docs.google.com/document/d/1KwS49k_32XyonLN4anqgpY7uWDpvj8kHZYVMrNUGBgs/edit?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4 transition-colors hover:border-accent/50 hover:bg-accent/10"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              Full user guide
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              The complete walkthrough — setup, importing, photos, pricing,
              listing, sharing, and troubleshooting. Opens in a new tab.
            </span>
          </span>
        </a>

        <Accordion
          type="multiple"
          defaultValue={["statuses", "pricing"]}
          className="mt-6 space-y-2"
        >
          {/* ── Album statuses ─────────────────────────────────────────── */}
          <AccordionItem value="statuses">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-accent" />
                Album statuses explained
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Every album moves through four statuses. The colored badge in
                your catalogue shows where each record is in the pipeline.
              </p>

              <div className="space-y-3">
                <div className="space-y-1">
                  <StatusChip
                    label="Unlisted"
                    className="border-border bg-muted/30 text-muted-foreground"
                  />
                  <p className="text-xs">
                    The starting point. The album is in your collection but has
                    no pricing yet and isn&apos;t for sale anywhere. Newly
                    imported or added records begin here.
                  </p>
                </div>

                <div className="space-y-1">
                  <StatusChip
                    label="Pricing"
                    className="border-amber-500/20 bg-amber-500/10 text-amber-400"
                  />
                  <p className="text-xs">
                    VinylVault has fetched a{" "}
                    <strong className="text-foreground">suggested price</strong>{" "}
                    from the market (Discogs/eBay), but you haven&apos;t put it
                    up for sale yet. Think of this as &quot;priced and ready to
                    list.&quot; This is <em>not</em> live anywhere — buyers
                    can&apos;t see it.
                  </p>
                </div>

                <div className="space-y-1">
                  <StatusChip
                    label="Listed"
                    className="border-green-500/20 bg-green-500/10 text-green-400"
                  />
                  <p className="text-xs">
                    The album is{" "}
                    <strong className="text-foreground">
                      live for sale
                    </strong>{" "}
                    on eBay and/or Discogs. Buyers can find and purchase it. You
                    can open the album to view the live listing links or delist
                    it.
                  </p>
                </div>

                <div className="space-y-1">
                  <StatusChip
                    label="Sold"
                    className="border-blue-500/20 bg-blue-500/10 text-blue-400"
                  />
                  <p className="text-xs">
                    The record sold. When it sells on one platform, VinylVault
                    automatically cancels the listing on the other so you
                    don&apos;t double-sell and records the sale price. The
                    buyer&apos;s shipping address is captured on the album so
                    you can print a label with whatever carrier you prefer.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
                <p className="font-medium text-foreground">
                  Pricing vs Listed — the key difference
                </p>
                <p className="mt-1">
                  <strong className="text-amber-400">Pricing</strong> = a price
                  has been calculated, but nothing is for sale.{" "}
                  <strong className="text-green-400">Listed</strong> = the album
                  is actually published and buyable on a marketplace.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── Pricing ────────────────────────────────────────────────── */}
          <AccordionItem value="pricing">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-accent" />
                How pricing works
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                VinylVault calculates a suggested price from real marketplace
                data so you don&apos;t have to guess.
              </p>

              <div className="space-y-2">
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-xs font-medium text-foreground">
                    1. Discogs (primary source)
                  </p>
                  <p className="mt-1 text-xs">
                    We match your record to its Discogs release and pull
                    grade-specific price suggestions, the lowest active asking
                    price, and how many copies are currently for sale.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-xs font-medium text-foreground">
                    2. eBay (fallback)
                  </p>
                  <p className="mt-1 text-xs">
                    If Discogs has no data for a release, we fall back to active
                    eBay listings as comparables. These are asking prices, which
                    typically run a bit above final sold prices.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">
                  Suggested price vs List price
                </p>
                <p className="text-xs">
                  The{" "}
                  <strong className="text-foreground">suggested price</strong> is
                  what the market data recommends. The{" "}
                  <strong className="text-foreground">list price</strong> is what
                  you actually sell for — it defaults to the suggestion, but you
                  can override it per album before listing.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">
                  Condition matters
                </p>
                <p className="text-xs">
                  Grades run{" "}
                  <span className="text-foreground">
                    Mint → Great → Good → Fair → Poor
                  </span>
                  . Higher grades pull higher comparable prices, so always set an
                  accurate condition before pricing.
                </p>
              </div>

              <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs text-accent">
                Prices are cached for 24 hours. Use Refresh Prices on an album,
                or select records in the catalogue and Auto-Price, to fetch
                again.
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── Importing ──────────────────────────────────────────────── */}
          <AccordionItem value="import">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-accent" />
                Importing your collection
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              <p className="text-xs">
                Three ways to get records in, all under the Import tab:
              </p>
              <ul className="space-y-2 text-xs">
                <li>
                  <strong className="text-foreground">CSV file</strong> — export
                  from any spreadsheet and map columns to Title, Artist, Genre,
                  Condition, and Catalog #.
                </li>
                <li>
                  <strong className="text-foreground">Box JSON files</strong> —
                  drop pre-analysed JSON; pricing, condition, and notes import
                  automatically with no extra fetch.
                </li>
                <li>
                  <strong className="text-foreground">Add Album</strong> — add a
                  single record by hand from the catalogue.
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* ── Cover photo matching ───────────────────────────────────── */}
          <AccordionItem value="photos">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-accent" />
                Cover photo matching
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              <p className="text-xs">
                Under Import → Cover Photos, drop a batch of front-cover photos.
                AI reads the artist and title off each cover and matches it to an
                album already in your catalogue.
              </p>
              <p className="text-xs">
                You review every match — high-confidence ones are pre-selected,
                and you can override the album for any photo — before anything is
                attached. Photos become the listing images on eBay and Discogs.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* ── Connections ────────────────────────────────────────────── */}
          <AccordionItem value="connections">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-accent" />
                Connecting eBay & Discogs
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm text-muted-foreground">
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">eBay</p>
                <p className="text-xs">
                  Settings → eBay Account → Connect eBay Account. You&apos;ll
                  need an active seller account with Managed Payments enabled and
                  at least one Shipping, Returns, and Payment business policy.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Discogs</p>
                <p className="text-xs">
                  Settings → Discogs → Connect Discogs Account, then log in and
                  authorize. Complete your Discogs seller profile (location,
                  currency, shipping policy) so listings appear publicly. A
                  personal access token is available as a fallback.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── Listing & selling ──────────────────────────────────────── */}
          <AccordionItem value="listing">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-accent" />
                Listing, selling & shipping
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              <ul className="space-y-2 text-xs">
                <li>
                  Open any album and use{" "}
                  <strong className="text-foreground">List on eBay</strong>{" "}
                  and/or{" "}
                  <strong className="text-foreground">List on Discogs</strong>.
                  The album moves to <span className="text-green-400">Listed</span>.
                </li>
                <li>
                  Listing on Discogs requires a resolved release — fetch prices
                  first so the release is identified.
                </li>
                <li>
                  When a record sells, VinylVault marks it{" "}
                  <span className="text-blue-400">Sold</span> and auto-cancels
                  the other platform&apos;s listing.
                </li>
                <li>
                  When a sale syncs, the buyer&apos;s shipping address is
                  recorded on the album so you can print a label with whatever
                  carrier you prefer.
                </li>
                <li>
                  <strong className="text-foreground">Delisting</strong> removes
                  the live listing and returns the album to your catalogue.
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* ── Bulk actions ───────────────────────────────────────────── */}
          <AccordionItem value="bulk">
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-accent" />
                Bulk actions
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              <p className="text-xs">
                In the catalogue, select multiple albums with the checkboxes to
                reveal bulk actions:
              </p>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <strong className="text-foreground">Auto-Price Selected</strong>{" "}
                  — fetch pricing for everything selected, in small batches.
                </li>
                <li>
                  <strong className="text-foreground">List on eBay</strong> —
                  list all selected albums at once.
                </li>
                <li>
                  <strong className="text-foreground">Delete</strong> — remove
                  albums (also delists them first).
                </li>
              </ul>
              <p className="text-xs">
                The Dashboard&apos;s{" "}
                <strong className="text-foreground">Price All Unlisted</strong>{" "}
                shortcut prices every unsold album that doesn&apos;t have a price
                yet.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Need the quick tour again? It shows automatically for new accounts.
        </p>
      </SheetContent>
    </Sheet>
  );
}
