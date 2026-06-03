import Link from "next/link";
import { ArrowLeft, Disc2 } from "lucide-react";

function MarketingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12">
      <div className="absolute inset-0 backdrop-blur-md bg-black/30 border-b border-white/[0.06]" />
      <div className="relative flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4A843]">
          <Disc2 className="h-4 w-4 text-black" />
        </div>
        <span className="font-display text-base font-bold text-white tracking-tight">VinylVault</span>
      </div>
      <div className="relative flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1 py-1">
        {([{ href: "/", label: "Home" }, { href: "/about", label: "About" }, { href: "/policy", label: "Policy" }] as const).map(({ href, label }) => (
          <Link key={href} href={href} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${href === "/about" ? "bg-white/15 text-white" : "text-white/60 hover:text-white"}`}>{label}</Link>
        ))}
        <Link href="/login" className="ml-1 rounded-full bg-[#D4A843] px-4 py-1.5 text-sm font-semibold text-black">Login</Link>
      </div>
    </nav>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[#D4A843]/8 blur-[120px]" />
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
              pull live market pricing from Discogs and eBay, list to both platforms simultaneously,
              auto-cancel when something sells, and generate prepaid shipping labels automatically.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold text-white mb-3">What we built</h2>
            <ul className="space-y-2">
              {[
                "Bulk import from CSV or pre-analysed JSON box files",
                "Live Discogs marketplace pricing by grade",
                "eBay active listing comparables as a fallback",
                "Dual-platform listing on eBay and Discogs with one click",
                "Automatic cross-cancellation when a sale is detected",
                "Shippo integration for prepaid USPS Media Mail labels",
                "Portfolio analytics: collection value, revenue, profit margin",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4A843]" />
                  {item}
                </li>
              ))}
            </ul>
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
              <a href="mailto:hello@vinylvault.app" className="text-[#D4A843] hover:underline">
                hello@vinylvault.app
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-14 flex gap-3">
          <Link href="/signup" className="rounded-full bg-[#D4A843] px-6 py-3 text-sm font-semibold text-black hover:opacity-90 transition-opacity">
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
