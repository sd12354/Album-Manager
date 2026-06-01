import { ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { PricingResult } from "@/types";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

function SourcePill({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  if (!active) return null;
  return (
    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
      {label}
    </span>
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
    <div className="grid gap-4 md:grid-cols-2">
      {/* ============ Discogs ============ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base font-semibold font-display">
            <div className="flex items-center gap-2">
              <span>Discogs</span>
              <SourcePill active={usingDiscogsForSuggestion} label="Source" />
            </div>
            {pricing.discogsReleaseId && (
              <a
                href={`https://www.discogs.com/release/${pricing.discogsReleaseId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-accent"
                title={pricing.discogsReleaseTitle ?? "View on Discogs"}
              >
                #{pricing.discogsReleaseId}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasDiscogs && (
            <p className="text-sm text-muted-foreground">
              No Discogs match. Click <strong>Fetch Latest Prices</strong> to
              search again.
            </p>
          )}

          {pricing.discogsPriceForCondition != null && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Suggested for condition
              </span>
              <span className="font-medium tabular-nums">
                {formatCurrency(pricing.discogsPriceForCondition)}
              </span>
            </div>
          )}

          {pricing.discogsMedian != null &&
            pricing.discogsMedian !== pricing.discogsPriceForCondition && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Median across grades
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(pricing.discogsMedian)}
                </span>
              </div>
            )}

          {pricing.discogsLowest != null && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Lowest active listing
              </span>
              <span className="font-medium tabular-nums">
                {formatCurrency(pricing.discogsLowest)}
              </span>
            </div>
          )}

          {pricing.discogsSalesCount != null && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">For sale now</span>
              <span className="font-medium tabular-nums">
                {pricing.discogsSalesCount}
              </span>
            </div>
          )}

          {orderedGrades.length > 0 && (
            <details className="group rounded-md border border-white/8 p-2 text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-[#F5F4F0]">
                All grade prices ({orderedGrades.length})
              </summary>
              <div className="mt-2 space-y-1">
                {orderedGrades.map((grade) => (
                  <div key={grade} className="flex justify-between">
                    <span className="text-muted-foreground">{grade}</span>
                    <span className="tabular-nums">
                      {formatCurrency(pricing.discogsConditionPrices![grade])}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {hasDiscogs && <ConfidenceMeter confidence={pricing.confidence} />}
        </CardContent>
      </Card>

      {/* ============ eBay ============ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base font-semibold font-display">
            <div className="flex items-center gap-2">
              <span>eBay</span>
              <SourcePill active={usingEbayForSuggestion} label="Source" />
              {hasEbay && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Active asks
                </span>
              )}
            </div>
            {pricing.ebayCount != null && (
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {pricing.ebayCount} listings
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasEbay && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                No eBay comparables fetched yet.
              </p>
              <p className="text-xs text-muted-foreground">
                eBay is used as a fallback when Discogs has no pricing for a
                release. (Sandbox returns very few real results — switch to
                production eBay credentials for live comparables.)
              </p>
            </div>
          )}

          {pricing.ebayMedian != null && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Median asking price
              </span>
              <span className="font-medium tabular-nums">
                {formatCurrency(pricing.ebayMedian)}
              </span>
            </div>
          )}

          {pricing.ebayLowest != null && pricing.ebayHighest != null && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Range</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(pricing.ebayLowest)} –{" "}
                {formatCurrency(pricing.ebayHighest)}
              </span>
            </div>
          )}

          {pricing.ebaySampleListings &&
            pricing.ebaySampleListings.length > 0 && (
              <details className="group rounded-md border border-white/8 p-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-[#F5F4F0]">
                  Sample comparables ({pricing.ebaySampleListings.length})
                </summary>
                <div className="mt-2 space-y-1">
                  {pricing.ebaySampleListings.map((item, i) => (
                    <a
                      key={i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex justify-between gap-2 text-muted-foreground hover:text-accent"
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

          {hasEbay && (
            <p className="pt-1 text-[11px] text-muted-foreground/70">
              Active listings = asking prices, typically ~15% above actual sold
              prices.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
