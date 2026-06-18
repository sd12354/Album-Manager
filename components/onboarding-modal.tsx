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

/* ─────────────────────────────────────────────────────────────────────────────
   Per-step visual mockups
───────────────────────────────────────────────────────────────────────────── */

function WelcomeImage() {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0b] overflow-hidden">
      {/* mini sidebar + content */}
      <div className="flex">
        <div className="w-10 border-r border-white/8 bg-[#090909] flex flex-col items-center gap-3 py-3">
          <div className="h-6 w-6 rounded-md bg-[#8b7fe8]/20 flex items-center justify-center">
            <Disc2 className="h-3 w-3 text-[#8b7fe8]" />
          </div>
          {["Dashboard","Catalogue","Import","Settings"].map((_, i) => (
            <div key={i} className={`h-5 w-5 rounded-md ${i === 0 ? "bg-white/15" : "bg-white/5"}`} />
          ))}
        </div>
        <div className="flex-1 p-3 space-y-2">
          <p className="text-[10px] font-bold text-white/80 font-mono">Dashboard</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[["Total Albums","1,388"],["Listed","47"],["Sold","12"],["Revenue","$2,340"]].map(([label, val]) => (
              <div key={label} className="rounded-md bg-white/5 px-2 py-1.5">
                <p className="text-[8px] text-white/40">{label}</p>
                <p className="text-[11px] font-bold text-white tabular-nums">{val}</p>
              </div>
            ))}
          </div>
          <div className="rounded-md bg-white/5 p-2">
            <p className="text-[8px] text-white/40 mb-1.5">Monthly Revenue</p>
            <div className="flex items-end gap-0.5 h-8">
              {[20,45,30,60,40,75,55,90,65,100,80,95].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm bg-[#8b7fe8]/50" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportImage() {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0b] p-3 space-y-2">
      {/* Tab bar */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-white/5 w-fit">
        <div className="rounded-md bg-[#8b7fe8] px-3 py-1 text-[9px] font-semibold text-black">CSV File</div>
        <div className="rounded-md px-3 py-1 text-[9px] font-medium text-white/40 flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-sm bg-white/20" />
          Box JSON
        </div>
      </div>
      {/* Drop zone */}
      <div className="rounded-lg border-2 border-dashed border-white/15 bg-white/[0.02] p-3 text-center">
        <div className="flex justify-center mb-1">
          <Upload className="h-5 w-5 text-white/30" />
        </div>
        <p className="text-[9px] text-white/40">Drop BOX_*_priced.json files here</p>
      </div>
      {/* File list preview */}
      {[["BOX_2_priced.json","142 records"],["BOX_3_priced.json","138 records"]].map(([name, count]) => (
        <div key={name} className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-3.5 rounded bg-[#8b7fe8]/20 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-sm bg-[#8b7fe8]" />
            </div>
            <span className="text-[9px] text-white/70 font-mono">{name}</span>
          </div>
          <span className="text-[9px] text-white/40">{count}</span>
        </div>
      ))}
    </div>
  );
}

function EbayImage() {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0b] p-3 space-y-2">
      {/* Connected badge */}
      <div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-[10px] text-green-400 font-medium">Connected as <strong>sam_820471</strong></span>
        </div>
        <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[8px] font-bold text-green-400 uppercase tracking-wide">Production</span>
      </div>
      {/* Checklist */}
      <div className="space-y-1.5">
        {["Seller account active","Managed Payments enabled","Business policies set","OAuth token connected"].map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#8b7fe8] shrink-0" />
            <span className="text-[9px] text-white/60">{item}</span>
          </div>
        ))}
      </div>
      {/* Mini listing preview */}
      <div className="rounded-lg bg-white/5 px-3 py-2">
        <p className="text-[8px] text-white/40 mb-1">Example listing</p>
        <p className="text-[10px] text-white/80 font-medium truncate">Average White Band - AWB Vinyl Record LP Great</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] text-[#8b7fe8] font-semibold">$301.96</span>
          <span className="text-[8px] text-white/30">· Category: R&amp;B Soul</span>
        </div>
      </div>
    </div>
  );
}

function DiscogsImage() {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0b] p-3 space-y-2">
      {/* Token field */}
      <div className="space-y-1">
        <p className="text-[9px] text-white/50">Personal Access Token</p>
        <div className="rounded-md border border-[#8b7fe8]/30 bg-white/5 px-2.5 py-1.5 flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {Array.from({length: 12}).map((_,i) => (
              <div key={i} className="h-1.5 w-1.5 rounded-full bg-[#8b7fe8]/60" />
            ))}
          </div>
          <span className="text-[8px] text-white/30 ml-1">••• configured</span>
        </div>
      </div>
      {/* Configured badge */}
      <div className="flex items-center justify-between rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5">
        <span className="text-[9px] text-emerald-400 font-medium">Token verified ✓</span>
        <span className="text-[8px] text-white/30">discogs.com/settings/developers</span>
      </div>
      {/* Seller profile */}
      <div className="rounded-lg bg-white/5 px-3 py-2 space-y-1.5">
        <p className="text-[8px] text-white/40">Seller profile status</p>
        {["Location set","Shipping policy added","Currency configured"].map((item) => (
          <div key={item} className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-[9px] text-white/60">{item}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
          <span className="text-[9px] text-white/60">Min price: $3.00</span>
        </div>
      </div>
    </div>
  );
}

function PricingImage() {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0b] overflow-hidden">
      {/* Discogs section */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-white">Discogs</span>
            <span className="rounded-full bg-[#8b7fe8]/15 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-[#8b7fe8]">Source</span>
            <div className="flex items-end gap-0.5 ml-1">
              {[1,2,3].map(i => (
                <div key={i} className={`w-1 rounded-sm ${i <= 3 ? "bg-green-400" : "bg-white/20"}`}
                     style={{ height: i === 1 ? 6 : i === 2 ? 9 : 12 }} />
              ))}
            </div>
          </div>
          <span className="text-[8px] text-white/40">#8805558 ↗</span>
        </div>
        <div className="space-y-1.5">
          {[["Suggested for your grade","$301.96","#8b7fe8"],["Lowest active","$1.72","white"],["For sale now","98 copies","white"]].map(([label, val, color]) => (
            <div key={label} className="flex justify-between">
              <span className="text-[9px] text-white/40">{label}</span>
              <span className="text-[9px] font-semibold tabular-nums" style={{ color: color === "#8b7fe8" ? "#8b7fe8" : "rgba(255,255,255,0.8)" }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/8" />
      {/* Suggested price */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div>
          <p className="text-[8px] text-white/40 uppercase tracking-wider">Suggested Price</p>
          <p className="text-lg font-bold text-[#8b7fe8] tabular-nums">$301.96</p>
        </div>
        <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[8px] font-bold text-green-400">Great</span>
      </div>
    </div>
  );
}

function ListingShippingImage() {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0b] p-3 space-y-2">
      {/* List on buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/5 px-2 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
          <div>
            <p className="text-[9px] font-medium text-green-400">Listed on eBay</p>
            <p className="text-[8px] text-white/30">View listing ↗</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/5 px-2 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
          <div>
            <p className="text-[9px] font-medium text-green-400">Listed on Discogs</p>
            <p className="text-[8px] text-white/30">View listing ↗</p>
          </div>
        </div>
      </div>
      {/* Sold + label */}
      <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[8px] text-white/40 uppercase tracking-wider">Sold</p>
          <span className="text-[9px] text-white/40">June 2, 2025</span>
        </div>
        <p className="text-base font-bold text-white tabular-nums">$301.96</p>
        <p className="text-[8px] text-green-400 mt-0.5">+$251.96 vs purchase price</p>
      </div>
      {/* Shipping label */}
      <div className="rounded-lg bg-[#8b7fe8]/10 border border-[#8b7fe8]/20 px-2.5 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-[#8b7fe8]" />
            <div>
              <p className="text-[9px] font-medium text-[#8b7fe8]">USPS Media Mail</p>
              <p className="text-[8px] text-white/40 font-mono">9400 1118 9956 1234 5678 90</p>
            </div>
          </div>
          <span className="text-[8px] bg-[#8b7fe8] text-black font-semibold px-1.5 py-0.5 rounded">PDF ↓</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Step definitions
───────────────────────────────────────────────────────────────────────────── */

interface Step {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  image: React.ReactNode;
  content: React.ReactNode;
}

const steps: Step[] = [
  {
    icon: <Disc2 className="h-8 w-8 text-accent" />,
    title: "Welcome to VinylVault",
    subtitle: "Your catalogue. Priced. Listed. Sold.",
    image: <WelcomeImage />,
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
    image: <ImportImage />,
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-1">
          <p className="font-semibold text-foreground text-xs">📄 CSV Import</p>
          <p className="text-xs">Export from any spreadsheet. Map columns to Title, Artist, Genre, Condition, and Catalog #.</p>
        </div>
        <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-1">
          <p className="font-semibold text-foreground text-xs">📦 Box JSON Files</p>
          <p className="text-xs">Drop pre-analysed JSON files — pricing, condition, and notes are all imported automatically. No extra fetch needed.</p>
        </div>
      </div>
    ),
  },
  {
    icon: <ShoppingBag className="h-8 w-8 text-accent" />,
    title: "Set up eBay",
    subtitle: "Connect your seller account",
    image: <EbayImage />,
    content: (
      <div className="space-y-2 text-sm">
        <ul className="space-y-2">
          {[
            { check: "Active eBay seller account", detail: "Verify at ebay.com → My eBay → Selling." },
            { check: "Managed Payments enabled", detail: "Enrol at ebay.com/sell/setup." },
            { check: "Business policies configured", detail: "At least one Shipping, Returns, and Payment policy required." },
            { check: "Connect in Settings", detail: "Settings → eBay Account → Connect eBay Account." },
          ].map(({ check, detail }) => (
            <li key={check} className="flex gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground text-xs">{check}</p>
                <p className="text-[11px] text-muted-foreground">{detail}</p>
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
    image: <DiscogsImage />,
    content: (
      <div className="space-y-2 text-sm">
        <ul className="space-y-2">
          {[
            { check: "Generate a Personal Access Token", detail: "discogs.com/settings/developers → Generate token → paste into Settings." },
            { check: "Complete your seller profile", detail: "discogs.com/sell/manage — location, currency, and a shipping policy are required for listings to appear publicly." },
            { check: "Test the connection", detail: "Settings → Discogs → Test Connection." },
          ].map(({ check, detail }) => (
            <li key={check} className="flex gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground text-xs">{check}</p>
                <p className="text-[11px] text-muted-foreground">{detail}</p>
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
    image: <PricingImage />,
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="grid grid-cols-2 gap-2">
          {[
            { title: "Per-album", desc: "Open album → Refresh Prices (↻)" },
            { title: "Bulk", desc: "Catalogue → select → Auto-Price" },
            { title: "Override", desc: "List Price Override field" },
            { title: "Pre-loaded", desc: "Box JSON files include pricing" },
          ].map(({ title, desc }) => (
            <div key={title} className="rounded-lg border border-border bg-secondary/30 px-2.5 py-2">
              <p className="font-medium text-foreground text-xs">{title}</p>
              <p className="text-[10px] mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs">
          Discogs pulls grade-specific prices. eBay active listings are used as a fallback when Discogs has no data.
        </p>
      </div>
    ),
  },
  {
    icon: <Package className="h-8 w-8 text-accent" />,
    title: "Listing & Shipping",
    subtitle: "List on eBay & Discogs, ship manually",
    image: <ListingShippingImage />,
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <ul className="space-y-1.5">
          {[
            "Open any album → use List on eBay and/or List on Discogs.",
            "If it sells on one platform, click Check if Sold — VinylVault auto-cancels the other listing.",
            "When a sale comes in, buyer's address is captured automatically — ship with the carrier of your choice.",
            "USPS Media Mail is the cheapest option for vinyl.",
          ].map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-accent text-xs font-medium">
          🎉 You&apos;re ready! Head to the Dashboard to get started.
        </div>
      </div>
    ),
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Modal
───────────────────────────────────────────────────────────────────────────── */

interface OnboardingModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function OnboardingModal({ forceOpen, onClose }: OnboardingModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) { setOpen(true); setStep(0); return; }
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch { /* ignore */ }
  }, [forceOpen]);

  function close() {
    try { window.localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
    onClose?.();
  }

  if (!open) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

      {/* Modal — wider to accommodate image + text side by side */}
      <div className="relative z-10 w-full max-w-2xl animate-fade-in-up">
        <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-0">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                {current.icon}
              </div>
              <div>
                <p className="font-display text-lg font-bold text-foreground leading-tight">{current.title}</p>
                <p className="text-xs text-muted-foreground">{current.subtitle}</p>
              </div>
            </div>
            <button onClick={close} className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors mt-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1 px-6 mt-4">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= step ? "bg-accent" : "bg-muted/40"}`}
              />
            ))}
          </div>

          {/* Body — image left, content right */}
          <div className="grid grid-cols-[1fr_1fr] gap-4 px-6 py-4">
            {/* Image panel */}
            <div className="min-w-0">
              {current.image}
            </div>
            {/* Text content */}
            <div className="min-w-0 overflow-y-auto max-h-56">
              {current.content}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{step + 1} / {steps.length}</span>
              <button onClick={close} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Skip tour
              </button>
            </div>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)}>Back</Button>
              )}
              {isLast ? (
                <Button size="sm" asChild>
                  <Link href="/dashboard" onClick={close}>Go to Dashboard</Link>
                </Button>
              ) : (
                <Button size="sm" onClick={() => setStep(s => s + 1)}>
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
