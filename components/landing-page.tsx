"use client";

import { useState } from "react";
import Link from "next/link";
import { CursorEffect } from "@/components/cursor-effect";
import { HomeIntro } from "@/components/home-intro";
import {
  ArrowRight,
  Disc2,
  DollarSign,
  Package,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Upload,
  Zap,
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
    desc: "Claude analyses Discogs and eBay data alongside artist collectability and genre demand to suggest the optimal price and write a conversion-optimised listing description.",
    color: "text-accent bg-accent/10",
  },
  {
    icon: DollarSign,
    title: "Live market pricing",
    desc: "Pulls live Discogs grade-specific prices and eBay active listings as hard data the AI builds on. Every recommendation is market-anchored.",
    color: "text-yellow-400 bg-yellow-400/10",
  },
  {
    icon: ShoppingBag,
    title: "Dual-platform listing",
    desc: "List on eBay and Discogs simultaneously with one click. When one sells, the other is automatically delisted.",
    color: "text-blue-400 bg-blue-400/10",
  },
  {
    icon: Package,
    title: "Auto shipping labels",
    desc: "Shippo integration auto-generates prepaid USPS Media Mail labels the moment a sale is detected.",
    color: "text-purple-400 bg-purple-400/10",
  },
  {
    icon: Upload,
    title: "Smart bulk import",
    desc: "Import from CSV or pre-analysed JSON box files. Pricing is pre-loaded — no extra fetch needed.",
    color: "text-green-400 bg-green-400/10",
  },
  {
    icon: TrendingUp,
    title: "Portfolio analytics",
    desc: "Track total collection value, revenue by month, and profit vs. purchase price across your catalogue.",
    color: "text-orange-400 bg-orange-400/10",
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Main LandingPage component
───────────────────────────────────────────────────────────────────────────── */
export function LandingPage({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "catalogue">("dashboard");

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
                { key: "dashboard", label: "Dashboard" },
                { key: "catalogue", label: "Catalogue" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                  activeTab === key
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Mockup with glow */}
        <div className="mx-auto max-w-3xl float">
          <div className="relative">
            <div className="absolute -inset-4 rounded-2xl bg-accent/10 blur-2xl" />
            <div className="relative">
              {activeTab === "dashboard" ? <DashboardMockup /> : <CatalogueMockup />}
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
                className="rounded-2xl border border-white/[0.10] bg-[#0e0e10] p-6 transition-all hover:border-white/20 hover:bg-[#121214]"
              >
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
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
            From box to sold in 4 steps
          </h2>
          <div className="space-y-4">
            {[
              {
                step: "01",
                title: "Import your collection",
                desc: "Drop in a CSV or your pre-analysed box JSON files. Pricing is auto-loaded — no manual entry required.",
              },
              {
                step: "02",
                title: "AI prices & describes every record",
                desc: "Claude analyses live Discogs & eBay data alongside artist collectability to suggest the optimal price and writes a sales-optimised listing description.",
              },
              {
                step: "03",
                title: "List on eBay & Discogs",
                desc: "Push listings to one or both platforms with the AI description pre-filled. Cross-cancellation is automatic when something sells.",
              },
              {
                step: "04",
                title: "Ship with one click",
                desc: "Shippo generates a prepaid USPS Media Mail label the moment a sale is detected. Print and go.",
              },
            ].map(({ step, title, desc }) => (
              <div
                key={step}
                className="flex gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 backdrop-blur-sm"
              >
                <span className="font-display text-3xl font-bold text-accent/30 leading-none mt-0.5 w-8 shrink-0">
                  {step}
                </span>
                <div>
                  <p className="font-display font-semibold text-white mb-1">{title}</p>
                  <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
                </div>
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
            <Link href="/policy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
            <Link href="/login" className="hover:text-white/60 transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
