"use client";

import { useState } from "react";
import Link from "next/link";
import { CursorEffect } from "@/components/cursor-effect";
import { HomeIntro } from "@/components/home-intro";
import {
  ArrowRight,
  Check,
  Disc2,
  DollarSign,
  ImageIcon,
  Package,
  Settings,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   Marketing nav
───────────────────────────────────────────────────────────────────────────── */
function MarketingNav({ active, isLoggedIn }: { active: "home" | "about" | "policy"; isLoggedIn?: boolean }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12">
      {/* Glass bg */}
      <div className="absolute inset-0 backdrop-blur-md bg-black/30 border-b border-white/[0.06]" />

      {/* Logo */}
      <div className="relative flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <Disc2 className="h-4 w-4 text-accent-foreground" />
        </div>
        <span className="font-display text-base font-bold text-white tracking-tight">
          VinylVault
        </span>
      </div>

      {/* Links */}
      <div className="relative flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1 py-1 backdrop-blur-sm">
        {(
          [
            { href: "/", label: "Home", key: "home" },
            { href: "/about", label: "About", key: "about" },
            { href: "/policy", label: "Policy", key: "policy" },
          ] as const
        ).map(({ href, label, key }) => (
          <Link
            key={key}
            href={href}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active === key
                ? "bg-white/15 text-white"
                : "text-white/60 hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
        <a
          href="https://docs.google.com/document/d/1KwS49k_32XyonLN4anqgpY7uWDpvj8kHZYVMrNUGBgs/edit?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full px-4 py-1.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
        >
          Guide
        </a>
        <Link
          href={isLoggedIn ? "/dashboard" : "/login"}
          className="ml-1 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          {isLoggedIn ? "Go to Dashboard" : "Login"}
        </Link>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Animated background blobs
───────────────────────────────────────────────────────────────────────────── */
function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-accent/10 blur-[120px] animate-blob" />
      <div className="absolute top-1/3 -right-32 h-[500px] w-[500px] rounded-full bg-purple-600/10 blur-[100px] animate-blob animation-delay-2" />
      <div className="absolute -bottom-32 left-1/3 h-[450px] w-[450px] rounded-full bg-amber-600/8 blur-[110px] animate-blob animation-delay-4" />
      <div className="absolute top-1/2 left-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/5 blur-[90px] animate-blob animation-delay-3" />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   App screenshot mockups
───────────────────────────────────────────────────────────────────────────── */
function DashboardMockup() {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0D0D0F] overflow-hidden shadow-2xl">
      {/* Top bar */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/[0.06]">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        <div className="ml-3 flex-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/30">
          vinylvault.app/dashboard
        </div>
      </div>
      <div className="flex">
        {/* Sidebar */}
        <div className="w-14 border-r border-white/[0.06] bg-[#090909] py-4 flex flex-col items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-accent/20 flex items-center justify-center">
            <Disc2 className="h-3.5 w-3.5 text-accent" />
          </div>
          {[LayoutDashIcon, LibraryIcon, UploadIcon, SettingsIcon].map((C, i) => (
            <C key={i} active={i === 0} />
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 p-4">
          <p className="font-display text-sm font-bold text-white mb-3">Dashboard</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: "Total Albums", value: "1,388" },
              { label: "Listed", value: "47" },
              { label: "Sold This Month", value: "12" },
              { label: "Revenue", value: "$2,340" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-white/[0.04] p-2.5">
                <p className="text-[9px] text-white/40">{s.label}</p>
                <p className="font-display text-sm font-bold text-white mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
          {/* Mini bar chart */}
          <div className="rounded-lg bg-white/[0.04] p-2.5">
            <p className="text-[9px] text-white/40 mb-2">Monthly Revenue</p>
            <div className="flex items-end gap-1 h-10">
              {[20, 45, 30, 60, 40, 75, 55, 80, 65, 90, 70, 100].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-accent/60"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CatalogueMockup() {
  const rows = [
    { title: "AWB", artist: "Average White Band", cond: "Great", price: "$301" },
    { title: "Tribute to Arsenio", artist: "Orchestra Harlow", cond: "Great", price: "$25" },
    { title: "Places & Spaces", artist: "Donald Byrd", cond: "Great", price: "$27" },
    { title: "Lo Ultimo", artist: "Ismael Rivera", cond: "Good", price: "$25" },
    { title: "Breakin' Away", artist: "Al Jarreau", cond: "Great", price: "$7" },
  ];
  return (
    <div className="rounded-xl border border-white/10 bg-[#0D0D0F] overflow-hidden shadow-2xl">
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/[0.06]">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        <div className="ml-3 flex-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/30">
          vinylvault.app/albums
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-sm font-bold text-white">Catalogue</p>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">1,388 albums</span>
        </div>
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 border-b border-white/[0.04]">
            <span className="text-[9px] text-white/30">TITLE</span>
            <span className="text-[9px] text-white/30">COND</span>
            <span className="text-[9px] text-white/30">PRICE</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]"
            >
              <div>
                <p className="text-[10px] font-medium text-white/90 truncate">{r.title}</p>
                <p className="text-[9px] text-white/35 truncate">{r.artist}</p>
              </div>
              <span className={`text-[9px] font-medium ${r.cond === "Great" ? "text-green-400" : "text-amber-400"}`}>
                {r.cond}
              </span>
              <span className="text-[10px] font-semibold text-accent">{r.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImportMockup() {
  const rows = [
    { title: "Head Hunters", artist: "Herbie Hancock", ok: true },
    { title: "Mister Magic", artist: "Grover Washington Jr.", ok: true },
    { title: "Feel Like Makin' Love", artist: "Roberta Flack", ok: true },
    { title: "Caravanserai", artist: "Santana", ok: true },
  ];
  return (
    <div className="rounded-xl border border-white/10 bg-[#0D0D0F] overflow-hidden shadow-2xl">
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/[0.06]">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        <div className="ml-3 flex-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/30">
          vinylvault.app/import
        </div>
      </div>
      <div className="p-4">
        <p className="font-display text-sm font-bold text-white mb-3">Import</p>
        {/* Drop zone */}
        <div className="rounded-xl border border-dashed border-accent/40 bg-accent/[0.04] px-4 py-5 text-center">
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15">
            <Upload className="h-4 w-4 text-accent" />
          </div>
          <p className="text-[10px] font-medium text-white/80">Drop your CSV or box JSON</p>
          <p className="text-[9px] text-white/35 mt-0.5">Pricing auto-loads from each file</p>
        </div>
        {/* Parsed rows */}
        <div className="mt-3 rounded-lg border border-white/[0.06] overflow-hidden">
          {rows.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.03] last:border-0"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500/15">
                <Check className="h-2.5 w-2.5 text-green-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-white/85 truncate">{r.title}</p>
                <p className="text-[9px] text-white/35 truncate">{r.artist}</p>
              </div>
              <span className="text-[9px] text-white/30">Ready</span>
            </div>
          ))}
        </div>
        {/* Progress + action */}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-full rounded-full bg-accent/70" />
          </div>
          <span className="rounded-md bg-accent px-2.5 py-1 text-[9px] font-semibold text-accent-foreground">
            Import 1,388
          </span>
        </div>
      </div>
    </div>
  );
}

function SettingsMockup() {
  const integrations = [
    { name: "eBay", note: "Connected as vinyl_collector_pro" },
    { name: "Discogs", note: "Connected · OAuth" },
  ];
  return (
    <div className="rounded-xl border border-white/10 bg-[#0D0D0F] overflow-hidden shadow-2xl">
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/[0.06]">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        <div className="ml-3 flex-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/30">
          vinylvault.app/settings
        </div>
      </div>
      <div className="p-4">
        <p className="font-display text-sm font-bold text-white mb-3">Settings</p>
        <p className="text-[9px] uppercase tracking-wider text-white/30 mb-2">Connections</p>
        <div className="space-y-2">
          {integrations.map((it) => (
            <div
              key={it.name}
              className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <div>
                  <p className="text-[11px] font-medium text-white/90">{it.name}</p>
                  <p className="text-[9px] text-white/35">{it.note}</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-emerald-400">
                Connected
              </span>
            </div>
          ))}
        </div>
        {/* Toggle row */}
        <div className="mt-3 flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
          <p className="text-[10px] text-white/70">Seller address on file</p>
          <span className="text-[10px] text-emerald-400">Saved</span>
        </div>
      </div>
    </div>
  );
}

/* Small icon stubs for the mockup sidebar */
function SidebarIcon({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div className={`h-7 w-7 rounded-md flex items-center justify-center ${active ? "bg-white/15" : "hover:bg-white/5"}`}>
      {children}
    </div>
  );
}
function LayoutDashIcon({ active }: { active?: boolean }) {
  return <SidebarIcon active={active}><div className="grid grid-cols-2 gap-0.5 w-3 h-3">{[0,1,2,3].map(i=><div key={i} className="rounded-[1px] bg-white/50" />)}</div></SidebarIcon>;
}
function LibraryIcon({ active }: { active?: boolean }) {
  return <SidebarIcon active={active}><div className="flex flex-col gap-0.5 w-3 h-3 justify-center">{[0,1,2].map(i=><div key={i} className="h-0.5 rounded-full bg-white/50" />)}</div></SidebarIcon>;
}
function UploadIcon({ active }: { active?: boolean }) {
  return <SidebarIcon active={active}><div className="w-3 h-3 flex items-center justify-center text-white/50 text-[8px]">↑</div></SidebarIcon>;
}
function SettingsIcon({ active }: { active?: boolean }) {
  return <SidebarIcon active={active}><div className="w-3 h-3 rounded-full border border-white/50" /></SidebarIcon>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Features grid
───────────────────────────────────────────────────────────────────────────── */
const features = [
  {
    icon: Sparkles,
    title: "AI pricing & descriptions",
    desc: "AI weighs Discogs and eBay market data alongside artist collectability and genre demand to suggest the optimal price. Bulk-priceable across your whole catalogue in minutes.",
    color: "text-accent bg-accent/10",
  },
  {
    icon: ImageIcon,
    title: "AI cover-photo matching",
    desc: "Drop in 100+ cover photos from any device. AI reads each cover and matches it to the right album in your catalogue. Manual picker fallback when the AI can't read a shot.",
    color: "text-pink-400 bg-pink-400/10",
  },
  {
    icon: DollarSign,
    title: "Live market pricing",
    desc: "Discogs grade-specific prices with eBay actives as a fallback. Cached 24h per album so re-pricing 1,000 records is fast and rate-limit-safe.",
    color: "text-yellow-400 bg-yellow-400/10",
  },
  {
    icon: ShoppingBag,
    title: "Dual-platform listing",
    desc: "List on eBay and Discogs with one click. When one sells, the other is auto-delisted. Already listed something yourself? Track it manually so it still shows up in your dashboard.",
    color: "text-blue-400 bg-blue-400/10",
  },
  {
    icon: Upload,
    title: "Smart bulk import",
    desc: "CSV with fuzzy column matching that recognises Discogs/eBay/GoldMine exports out of the box, or pre-analysed Box JSON with pricing baked in. Scales cleanly past 1,000 albums.",
    color: "text-green-400 bg-green-400/10",
  },
  {
    icon: Users,
    title: "Share & analyse",
    desc: "Invite collaborators (viewer or editor) to help manage a collection. Dashboard tracks total value, monthly sales, and photo-coverage. Export the whole catalogue to CSV or JSON anytime.",
    color: "text-orange-400 bg-orange-400/10",
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Main LandingPage component
───────────────────────────────────────────────────────────────────────────── */
type PreviewTab = "dashboard" | "catalogue" | "import" | "settings";

export function LandingPage({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("dashboard");

  return (
    <div className="min-h-screen bg-[#050507] text-white selection:bg-accent/30 [&_*]:cursor-none cursor-none">
      <HomeIntro />
      <CursorEffect />
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(40px, -60px) scale(1.08); }
          66%       { transform: translate(-30px, 30px) scale(0.94); }
        }
        .animate-blob { animation: blob 14s ease-in-out infinite; }
        .animation-delay-2 { animation-delay: 2s; }
        .animation-delay-3 { animation-delay: 5s; }
        .animation-delay-4 { animation-delay: 8s; }
        @keyframes shimmer-text {
          0%, 100% { background-position: 0% 50%; }
          50%       { background-position: 100% 50%; }
        }
        .shimmer-text {
          background: linear-gradient(135deg, #8b7fe8 0%, #b9a9f5 40%, #8b7fe8 60%, #5b4ba8 100%);
          background-size: 200% 200%;
          animation: shimmer-text 4s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-12px); }
        }
        .float { animation: float 6s ease-in-out infinite; }
      `}</style>

      <AnimatedBackground />
      <MarketingNav active="home" isLoggedIn={isLoggedIn} />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section data-cursor-hero className="relative flex flex-col items-center justify-center px-6 pb-24 pt-40 text-center md:pt-48">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-4 py-1.5 text-sm text-accent">
          <Sparkles className="h-3.5 w-3.5" />
          Now with AI pricing &amp; listing descriptions
        </div>

        <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.1] tracking-tight md:text-7xl">
          Your vinyl catalogue.{" "}
          <span className="shimmer-text">Priced. Listed. Sold.</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-white/60 leading-relaxed">
          VinylVault combines live market data from Discogs &amp; eBay with AI-powered pricing
          analysis and description writing — so every listing is optimised to sell.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-accent-foreground shadow-[0_0_30px_rgba(139,127,232,0.4)] transition-all hover:shadow-[0_0_40px_rgba(139,127,232,0.5)] hover:scale-[1.02]"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
          >
            Sign in
          </Link>
        </div>

        {/* Stats strip */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm">
          {[
            { value: "1,388+", label: "Records imported" },
            { value: "2 platforms", label: "eBay & Discogs" },
            { value: "AI-powered", label: "Pricing & descriptions" },
          ].map(({ value, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="font-display font-bold text-accent">{value}</span>
              <span className="text-white/40">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── App Preview ─────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-28 md:px-12">
        {/* Tab switcher */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-sm">
            {(
              [
                { key: "dashboard", label: "Dashboard", icon: TrendingUp },
                { key: "catalogue", label: "Catalogue", icon: Disc2 },
                { key: "import", label: "Import", icon: Upload },
                { key: "settings", label: "Settings", icon: Settings },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all sm:px-5 ${
                  activeTab === key
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Mockup with glow */}
        <div className="mx-auto max-w-3xl float">
          <div className="relative">
            <div className="absolute -inset-4 rounded-2xl bg-accent/10 blur-2xl" />
            <div key={activeTab} className="relative animate-fade-in">
              {activeTab === "dashboard" && <DashboardMockup />}
              {activeTab === "catalogue" && <CatalogueMockup />}
              {activeTab === "import" && <ImportMockup />}
              {activeTab === "settings" && <SettingsMockup />}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-28 md:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl font-bold md:text-4xl">
              Everything a serious seller needs
            </h2>
            <p className="mt-3 text-white/50">
              Built specifically for vinyl record sellers who move volume.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc, color }) => (
              <div
                key={title}
                className="group rounded-2xl border border-white/[0.10] bg-[#0e0e10] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/25 hover:bg-[#121214] hover:shadow-[0_12px_40px_-12px_rgba(139,127,232,0.35)]"
              >
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${color} transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-base font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/70 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-28 md:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl font-bold text-center mb-12 md:text-4xl">
            From box to sold in 5 steps
          </h2>
          <div className="relative space-y-4">
            {/* Connecting line behind the icon badges */}
            <div className="pointer-events-none absolute left-[45px] top-12 bottom-12 hidden w-px bg-gradient-to-b from-accent/40 via-accent/15 to-transparent sm:block" />
            {[
              {
                step: "01",
                title: "Import your collection",
                desc: "Drop in a CSV (auto-detects columns) or pre-analysed Box JSON files with pricing baked in. Scales cleanly past 1,000 albums.",
                icon: Upload,
                color: "text-green-400 bg-green-400/10",
              },
              {
                step: "02",
                title: "Attach cover photos in bulk",
                desc: "Drop 100+ cover photos at once — AI reads each one and matches it to the right album. Manual picker fallback when the cover is unreadable.",
                icon: ImageIcon,
                color: "text-pink-400 bg-pink-400/10",
              },
              {
                step: "03",
                title: "Price every record",
                desc: "One-click Auto-Price pulls live Discogs grade-specific data with eBay actives as fallback. Need nuance? AI-Price runs deeper analysis on every record using market signals and collector demand.",
                icon: Sparkles,
                color: "text-accent bg-accent/10",
              },
              {
                step: "04",
                title: "List on eBay & Discogs",
                desc: "Push listings to one or both platforms with AI-generated descriptions. Cross-cancellation is automatic when something sells.",
                icon: ShoppingBag,
                color: "text-blue-400 bg-blue-400/10",
              },
              {
                step: "05",
                title: "Ship on your terms",
                desc: "Buyer's address is captured on every sale so you can ship manually with the carrier of your choice. Already shipped or listed outside VinylVault? Track it manually.",
                icon: Package,
                color: "text-purple-400 bg-purple-400/10",
              },
            ].map(({ step, title, desc, icon: Icon, color }, i) => (
              <div
                key={step}
                className={`group relative flex items-start gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:bg-white/[0.04] animate-fade-in-up stagger-${Math.min(i + 1, 5)}`}
              >
                {/* Icon badge with step number */}
                <div className="relative z-10 shrink-0">
                  <div
                    className={`flex h-[52px] w-[52px] items-center justify-center rounded-xl ${color} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-[#0e0e10] font-display text-[10px] font-bold text-accent">
                    {step}
                  </span>
                </div>
                <div className="pt-1">
                  <p className="font-display font-semibold text-white mb-1 transition-colors group-hover:text-accent">
                    {title}
                  </p>
                  <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
                </div>
                <ArrowRight className="ml-auto mt-1 h-4 w-4 shrink-0 self-center text-white/0 transition-all duration-300 group-hover:translate-x-1 group-hover:text-accent/70" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="relative px-6 pb-28 md:px-12">
        <div className="mx-auto max-w-2xl rounded-3xl border border-accent/20 bg-gradient-to-b from-accent/10 to-transparent p-12 text-center backdrop-blur-sm">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15">
              <Disc2 className="h-8 w-8 text-accent" />
            </div>
          </div>
          <h2 className="font-display text-3xl font-bold mb-3">
            Ready to start selling?
          </h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Import your first box, connect your accounts, and get your collection
            priced and listed in minutes.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-sm font-semibold text-accent-foreground shadow-[0_0_40px_rgba(139,127,232,0.3)] transition-all hover:shadow-[0_0_50px_rgba(139,127,232,0.45)] hover:scale-[1.02]"
          >
            Create your free account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="relative border-t border-white/[0.06] px-6 py-8 md:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-sm text-white/30 sm:flex-row">
          <div className="flex items-center gap-2">
            <Disc2 className="h-4 w-4 text-accent/60" />
            <span className="font-display font-semibold text-white/50">VinylVault</span>
          </div>
          <p>© {new Date().getFullYear()} VinylVault. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/about" className="hover:text-white/60 transition-colors">About</Link>
            <a
              href="https://docs.google.com/document/d/1KwS49k_32XyonLN4anqgpY7uWDpvj8kHZYVMrNUGBgs/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/60 transition-colors"
            >
              Guide
            </a>
            <Link href="/policy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
            <Link href="/login" className="hover:text-white/60 transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
