"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Disc2,
  DollarSign,
  Package,
  ShoppingBag,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "vinylvault.onboarded";

interface Step {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  content: React.ReactNode;
}

const steps: Step[] = [
  {
    icon: <Disc2 className="h-8 w-8 text-accent" />,
    title: "Welcome to VinylVault",
    subtitle: "Your catalogue. Priced. Listed. Sold.",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          VinylVault helps you manage your vinyl record collection, get accurate
          market pricing, and list albums for sale on <strong className="text-foreground">eBay</strong> and{" "}
          <strong className="text-foreground">Discogs</strong> — all in one place.
        </p>
        <p>This quick walkthrough covers the five things you need to get set up:</p>
        <ul className="ml-4 space-y-1.5 list-none">
          {["Import your collection", "Connect eBay", "Connect Discogs", "Fetch pricing", "List & ship"].map(
            (item, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
                  {i + 1}
                </span>
                {item}
              </li>
            )
          )}
        </ul>
      </div>
    ),
  },
  {
    icon: <Upload className="h-8 w-8 text-accent" />,
    title: "Import your collection",
    subtitle: "Two ways to get your records in",
    content: (
      <div className="space-y-4 text-sm">
        <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-2">
          <p className="font-semibold text-foreground">📄 CSV Import</p>
          <p className="text-muted-foreground">
            Export from any spreadsheet. Map columns to Title, Artist, Genre, Condition, and Catalog #.
            Head to <strong className="text-foreground">Import → CSV File</strong>.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-2">
          <p className="font-semibold text-foreground">📦 Box JSON Files</p>
          <p className="text-muted-foreground">
            Got a pre-analysed JSON file (like the BOX_*_priced.json format)? Drop it into{" "}
            <strong className="text-foreground">Import → Box JSON Files</strong>. Pricing,
            condition, and notes are imported automatically — no extra fetch needed.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          You can also add albums one at a time from the Catalogue page using the{" "}
          <strong className="text-foreground">Add Album</strong> button.
        </p>
      </div>
    ),
  },
  {
    icon: <ShoppingBag className="h-8 w-8 text-accent" />,
    title: "Set up eBay",
    subtitle: "Connect your seller account",
    content: (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">Before you can list on eBay, make sure:</p>
        <ul className="space-y-2.5">
          {[
            {
              check: "You have an active eBay seller account",
              detail: "Go to ebay.com → My eBay → Selling to verify your account is in good standing.",
            },
            {
              check: "Managed Payments is enabled",
              detail: "eBay requires Managed Payments for all new sellers. Enrol at ebay.com/sell/setup.",
            },
            {
              check: "Business policies are configured",
              detail: "Set up at least one Shipping, Returns, and Payment policy in your eBay account settings.",
            },
            {
              check: "Connect in VinylVault Settings",
              detail: "Go to Settings → eBay Account → Connect eBay Account. This grants listing permission.",
            },
          ].map(({ check, detail }, i) => (
            <li key={i} className="flex gap-3">
              <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{check}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    icon: <Disc2 className="h-8 w-8 text-accent" />,
    title: "Set up Discogs",
    subtitle: "Marketplace selling & pricing",
    content: (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Discogs serves two roles here: <strong className="text-foreground">pricing data</strong> and{" "}
          <strong className="text-foreground">marketplace listings</strong>.
        </p>
        <ul className="space-y-2.5">
          {[
            {
              check: "Generate a Personal Access Token",
              detail: "Visit discogs.com/settings/developers → Generate a new token. Paste it into Settings → Discogs Integration.",
            },
            {
              check: "Complete your seller profile",
              detail: "Go to discogs.com/sell/manage. Set your location, currency, and at least one shipping policy — otherwise listings won't appear publicly.",
            },
            {
              check: "Test the connection",
              detail: "Use the Test Connection button in Settings → Discogs to confirm your token works.",
            },
          ].map(({ check, detail }, i) => (
            <li key={i} className="flex gap-3">
              <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">{check}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    icon: <DollarSign className="h-8 w-8 text-accent" />,
    title: "Pricing",
    subtitle: "Market-accurate suggested prices",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          VinylVault pulls live market data from Discogs (primary) and eBay active listings
          (fallback) to suggest a fair price for each album.
        </p>
        <div className="space-y-2">
          {[
            {
              title: "Per-album pricing",
              desc: "Open any album → click Refresh Prices (↻). Discogs returns grade-specific suggested prices.",
            },
            {
              title: "Bulk pricing",
              desc: "In Catalogue, select albums → Auto-Price Selected. Runs in batches of 15 to stay within API limits.",
            },
            {
              title: "Override the price",
              desc: "The List Price Override field lets you set any price before listing — the suggested price is just a starting point.",
            },
            {
              title: "Box JSON data",
              desc: "If you imported from a pre-analysed JSON file, pricing is already loaded — no fetch needed.",
            },
          ].map(({ title, desc }, i) => (
            <div key={i} className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
              <p className="font-medium text-foreground text-sm">{title}</p>
              <p className="text-xs mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: <Package className="h-8 w-8 text-accent" />,
    title: "Listing & Shipping",
    subtitle: "List on eBay & Discogs, ship with Shippo",
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Once an album has a price, you can list it on either or both platforms:</p>
        <ul className="space-y-2">
          {[
            "Open any album → use <strong>List on eBay</strong> and/or <strong>List on Discogs</strong>.",
            "If it sells on one platform, click <strong>Check if Sold</strong> — VinylVault auto-cancels the other listing.",
            "For shipping, add your <strong>Shippo API key</strong> + seller address in Settings → Shipping. Labels are generated automatically when a sale is detected.",
            "USPS Media Mail is selected by default — the cheapest legal option for vinyl records.",
            "Use the <strong>Download label (PDF)</strong> link on the sold album to print and ship.",
          ].map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span dangerouslySetInnerHTML={{ __html: `<span class="text-foreground">${item}</span>`.replace(/<strong>/g, '<strong class="font-semibold text-foreground">') }} />
            </li>
          ))}
        </ul>
        <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-accent text-xs font-medium">
          🎉 You&apos;re ready! Head to the Dashboard to get started.
        </div>
      </div>
    ),
  },
];

interface OnboardingModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function OnboardingModal({ forceOpen, onClose }: OnboardingModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setStep(0);
      return;
    }
    try {
      const done = window.localStorage.getItem(STORAGE_KEY);
      if (!done) setOpen(true);
    } catch {
      // ignore
    }
  }, [forceOpen]);

  function close() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
    onClose?.();
  }

  if (!open) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg animate-fade-in-up">
        <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-0">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10">
                {current.icon}
              </div>
              <div>
                <p className="font-display text-lg font-bold text-foreground leading-tight">
                  {current.title}
                </p>
                <p className="text-sm text-muted-foreground">{current.subtitle}</p>
              </div>
            </div>
            <button
              onClick={close}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1 px-6 mt-5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i <= step ? "bg-accent" : "bg-muted/40"
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="px-6 py-5 min-h-[260px]">{current.content}</div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {step + 1} / {steps.length}
              </span>
              <button
                onClick={close}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip tour
              </button>
            </div>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep((s) => s - 1)}
                >
                  Back
                </Button>
              )}
              {isLast ? (
                <Button size="sm" onClick={close} asChild>
                  <Link href="/dashboard" onClick={close}>
                    Go to Dashboard
                  </Link>
                </Button>
              ) : (
                <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
