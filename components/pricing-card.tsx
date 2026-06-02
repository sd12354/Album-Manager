"use client";

import { ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { PricingResult } from "@/types";
import { ConfidenceMeter } from "@/components/confidence-meter";

interface PricingCardProps {
  pricing: PricingResult;
}

const DISCOGS_GRADE_ORDER = [
  "Mint (M)",
  "Near Mint (NM or M-)",
  "Very Good Plus (VG+)",
  "Very Good (VG)",
  "Good Plus (G+)",
  "Good (G)",
  "Fair (F)",
  "Poor (P)",
];

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums ${highlight ? "font-semibold text-[#F5F4F0]" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function PricingCard({ pricing }: PricingCardProps) {
  const hasDiscogs =
    pricing.discogsMedian != null ||
    pricing.discogsPriceForCondition != null ||
    pricing.discogsReleaseId != null;

  const hasEbay =
    pricing.ebayMedian != null ||
    (pricing.ebayComparables && pricing.ebayComparables.length > 0);

  const orderedGrades = pricing.discogsConditionPrices
    ? DISCOGS_GRADE_ORDER.filter(
        (g) => pricing.discogsConditionPrices![g] != null
      )
    : [];

  const usingDiscogsForSuggestion =
    pricing.suggestionSource === "discogs-condition" ||
    pricing.suggestionSource === "discogs-median";
  const usingEbayForSuggestion = pricing.suggestionSource === "ebay-active";

  return (
    <div className="rounded-xl border border-white/8 bg-card overflow-hidden">
      {/* ── Discogs section ──────────────────────────────────── */}
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-semibold">Discogs</span>
            {usingDiscogsForSuggestion && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
                Source
              </span>
            )}
            {hasDiscogs && (
              <ConfidenceMeter confidence={pricing.confidence} />
            )}
          </div>
          {pricing.discogsReleaseId && (
            <a
              href={`https://www.discogs.com/release/${pricing.discogsReleaseId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors"
              title={pricing.discogsReleaseTitle ?? "View on Discogs"}
            >
              #{pricing.discogsReleaseId}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {!hasDiscogs ? (
          <p className="text-sm text-muted-foreground">
            No Discogs match — click <strong className="text-[#F5F4F0]">Fetch Latest Prices</strong> to search.
          </p>
        ) : (
          <div className="space-y-2.5">
            {pricing.discogsPriceForCondition != null && (
              <Row
                label="Suggested for your grade"
                value={formatCurrency(pricing.discogsPriceForCondition)}
                highlight
              />
            )}
            {pricing.discogsMedian != null &&
              pricing.discogsMedian !== pricing.discogsPriceForCondition && (
                <Row
                  label="Median across grades"
                  value={formatCurrency(pricing.discogsMedian)}
                />
              )}
            {pricing.discogsLowest != null && (
              <Row
                label="Lowest active listing"
                value={formatCurrency(pricing.discogsLowest)}
              />
            )}
            {pricing.discogsSalesCount != null && (
              <Row
                label="For sale now"
                value={pricing.discogsSalesCount.toString()}
              />
            )}

            {orderedGrades.length > 0 && (
              <details className="group pt-1">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-[#F5F4F0] transition-colors select-none">
                  All grade prices ({orderedGrades.length})
                </summary>
                <div className="mt-2 space-y-1.5 rounded-lg border border-white/8 bg-white/[0.02] p-3">
                  {orderedGrades.map((grade) => (
                    <div key={grade} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{grade}</span>
                      <span className="tabular-nums">
                        {formatCurrency(pricing.discogsConditionPrices![grade])}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* ── eBay section ─────────────────────────────────────── */}
      {(hasEbay || !hasDiscogs) && (
        <>
          <div className="border-t border-white/8" />
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold">eBay</span>
                {usingEbayForSuggestion && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
                    Source
                  </span>
                )}
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Active asks
                </span>
              </div>
              {pricing.ebayCount != null && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {pricing.ebayCount} listings
                </span>
              )}
            </div>

            {!hasEbay ? (
              <p className="text-sm text-muted-foreground">
                eBay is a fallback when Discogs has no pricing. Sandbox returns
                very few results — use production credentials for live data.
              </p>
            ) : (
              <div className="space-y-2.5">
                {pricing.ebayMedian != null && (
                  <Row
                    label="Median asking price"
                    value={formatCurrency(pricing.ebayMedian)}
                    highlight
                  />
                )}
                {pricing.ebayLowest != null && pricing.ebayHighest != null && (
                  <Row
                    label="Range"
                    value={`${formatCurrency(pricing.ebayLowest)} – ${formatCurrency(pricing.ebayHighest)}`}
                  />
                )}

                {pricing.ebaySampleListings && pricing.ebaySampleListings.length > 0 && (
                  <details className="group pt-1">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-[#F5F4F0] transition-colors select-none">
                      Sample comparables ({pricing.ebaySampleListings.length})
                    </summary>
                    <div className="mt-2 space-y-1.5 rounded-lg border border-white/8 bg-white/[0.02] p-3">
                      {pricing.ebaySampleListings.map((item, i) => (
                        <a
                          key={i}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex justify-between gap-2 text-xs text-muted-foreground hover:text-accent transition-colors"
                        >
                          <span className="truncate" title={item.title}>
                            {item.title}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {formatCurrency(item.price)}
                          </span>
                        </a>
                      ))}
                    </div>
                  </details>
                )}

                <p className="pt-1 text-[11px] text-muted-foreground/60">
                  Active asks run ~15% above actual sold prices.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
