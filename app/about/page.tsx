import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Disc2,
  Package,
  Plug,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";

function MarketingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12">
      <div className="absolute inset-0 backdrop-blur-md bg-black/30 border-b border-white/[0.06]" />
      <div className="relative flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8b7fe8]">
          <Disc2 className="h-4 w-4 text-black" />
        </div>
        <span className="font-display text-base font-bold text-white tracking-tight">VinylVault</span>
      </div>
      <div className="relative flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1 py-1">
        {([{ href: "/", label: "Home" }, { href: "/about", label: "About" }, { href: "/policy", label: "Policy" }] as const).map(({ href, label }) => (
          <Link key={href} href={href} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${href === "/about" ? "bg-white/15 text-white" : "text-white/60 hover:text-white"}`}>{label}</Link>
        ))}
        <Link href="/login" className="ml-1 rounded-full bg-[#8b7fe8] px-4 py-1.5 text-sm font-semibold text-black">Login</Link>
      </div>
    </nav>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[#8b7fe8]/8 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-purple-600/8 blur-[100px]" />
      </div>

      <MarketingNav />

      <div className="relative mx-auto max-w-2xl px-6 pt-36 pb-24">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-10">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <h1 className="font-display text-4xl font-bold mb-4">About VinylVault</h1>
        <p className="text-white/50 text-lg leading-relaxed mb-10">
          Built for serious vinyl sellers who want a smarter way to manage, price, and move their collection.
        </p>

        <div className="space-y-8 text-white/70 leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">Our story</h2>
            <p>
              VinylVault was built out of frustration with spreadsheets. When you&apos;re dealing with hundreds
              — or thousands — of records across boxes, manually looking up prices on Discogs, copying
              listings to eBay, and tracking sales in a Google Sheet stops scaling fast.
            </p>
            <p className="mt-3">
              We built VinylVault to handle the entire pipeline: import your collection in bulk,
              let AI price and describe every record from live market data, list to both platforms
              simultaneously, auto-cancel when something sells, and capture the buyer&apos;s
              shipping address so you can ship with any carrier.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-4">What we built</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: Upload,
                  title: "Bulk import",
                  desc: "CSV or pre-analysed JSON box files, with pricing auto-loaded.",
                  color: "text-green-400 bg-green-400/10",
                },
                {
                  icon: Sparkles,
                  title: "AI pricing & descriptions",
                  desc: "Claude prices each record from live Discogs & eBay data and writes the listing.",
                  color: "text-[#8b7fe8] bg-[#8b7fe8]/10",
                },
                {
                  icon: Camera,
                  title: "AI photo matching",
                  desc: "Auto-attach cover photos to the right album — even matching cover art to Discogs when text is hard to read. Supports HEIC/HEIF.",
                  color: "text-pink-400 bg-pink-400/10",
                },
                {
                  icon: ShoppingBag,
                  title: "Dual-platform listing",
                  desc: "List to eBay and Discogs at once, with automatic cross-cancellation on sale.",
                  color: "text-blue-400 bg-blue-400/10",
                },
                {
                  icon: Package,
                  title: "Buyer address captured",
                  desc: "Ship manually with any carrier — buyer's address is recorded on every sale.",
                  color: "text-purple-400 bg-purple-400/10",
                },
                {
                  icon: Plug,
                  title: "One-click connections",
                  desc: "Connect eBay and Discogs with secure OAuth — no tokens to paste.",
                  color: "text-amber-400 bg-amber-400/10",
                },
                {
                  icon: TrendingUp,
                  title: "Portfolio analytics",
                  desc: "Track collection value, monthly revenue, and profit vs. purchase price.",
                  color: "text-orange-400 bg-orange-400/10",
                },
                {
                  icon: Disc2,
                  title: "Grade-aware pricing",
                  desc: "Live Discogs marketplace prices by condition, with eBay comparables as a fallback.",
                  color: "text-cyan-400 bg-cyan-400/10",
                },
              ].map(({ icon: Icon, title, desc, color }) => (
                <div
                  key={title}
                  className="group rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#8b7fe8]/30 hover:bg-white/[0.04]"
                >
                  <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${color} transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="font-display text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-sm text-white/55 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">Who it&apos;s for</h2>
            <p>
              VinylVault is designed for people who sell vinyl records at volume — estate sellers,
              record store owners, dedicated collectors who also sell, and anyone who&apos;s found themselves
              managing more than a handful of albums and needs a proper system.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">Get in touch</h2>
            <p>
              VinylVault is actively developed. If you have feedback, feature requests, or need help
              getting set up, reach out at{" "}
              <a href="mailto:hello@vinylvault.app" className="text-[#8b7fe8] hover:underline">
                hello@vinylvault.app
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-14 flex gap-3">
          <Link href="/signup" className="rounded-full bg-[#8b7fe8] px-6 py-3 text-sm font-semibold text-black hover:opacity-90 transition-opacity">
            Get started
          </Link>
          <Link href="/" className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/70 hover:text-white transition-colors">
            Back to home
          </Link>
        </div>
      </div>

      <footer className="relative border-t border-white/[0.06] px-6 py-6 text-center text-sm text-white/30">
        © {new Date().getFullYear()} VinylVault. All rights reserved.
      </footer>
    </div>
  );
}
