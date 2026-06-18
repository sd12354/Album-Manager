import Link from "next/link";
import { ArrowLeft, Disc2 } from "lucide-react";

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
        {[{ href: "/", label: "Home" }, { href: "/about", label: "About" }, { href: "/policy", label: "Policy" }].map(({ href, label }) => (
          <Link key={href} href={href} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${href === "/policy" ? "bg-white/15 text-white" : "text-white/60 hover:text-white"}`}>{label}</Link>
        ))}
        <Link href="/login" className="ml-1 rounded-full bg-[#8b7fe8] px-4 py-1.5 text-sm font-semibold text-black">Login</Link>
      </div>
    </nav>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
      <div className="text-white/60 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function PolicyPage() {
  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-0 h-[500px] w-[500px] rounded-full bg-[#8b7fe8]/6 blur-[120px]" />
      </div>

      <MarketingNav />

      <div className="relative mx-auto max-w-2xl px-6 pt-36 pb-24">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-10">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <h1 className="font-display text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-white/40 text-sm mb-10">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="space-y-10">
          <Section title="Overview">
            <p>
              VinylVault (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your privacy.
              This policy explains what data we collect, how we use it, and your rights as a user.
            </p>
          </Section>

          <Section title="Data we collect">
            <p><strong className="text-white">Account data:</strong> Your email address and password (hashed and stored securely via Supabase Auth).</p>
            <p><strong className="text-white">Album catalogue:</strong> Record titles, artists, conditions, pricing data, and sale records you enter into the app.</p>
            <p><strong className="text-white">Integration credentials:</strong> eBay and Discogs access tokens obtained when you connect those accounts via OAuth (or, optionally, a Discogs personal access token you paste yourself). These are stored securely and used solely to make API calls on your behalf.</p>
            <p><strong className="text-white">Photos:</strong> Album photos you upload are stored in Supabase Storage and linked only to your account. HEIC/HEIF images are converted to JPEG in your browser before upload.</p>
          </Section>

          <Section title="How we use your data">
            <p>We use your data solely to provide the VinylVault service:</p>
            <ul className="space-y-1.5 ml-4">
              {[
                "Authenticating your account",
                "Storing and displaying your vinyl catalogue",
                "Fetching pricing from Discogs and eBay using your credentials",
                "Generating AI pricing suggestions and listing descriptions",
                "Matching uploaded cover photos to the correct album using AI",
                "Creating and managing listings on eBay and Discogs on your behalf",
                "Computing portfolio analytics shown in your dashboard",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/40" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-2">We do not sell your data, use it for advertising, or share it with third parties beyond the integration providers (eBay, Discogs) you explicitly connect.</p>
          </Section>

          <Section title="Third-party integrations">
            <p>When you connect eBay or Discogs, you agree to their respective terms of service and privacy policies. VinylVault acts as an intermediary and only calls these APIs with credentials you provide.</p>
          </Section>

          <Section title="AI processing">
            <p>VinylVault uses Anthropic&apos;s Claude models to power AI pricing analysis, listing-description generation, and cover-photo matching. To do this, relevant album metadata (such as title, artist, and condition) and album cover photos you choose to analyse are sent to Anthropic&apos;s API.</p>
            <p>This data is processed only to return results to you. Per Anthropic&apos;s API terms, it is not used to train their models. AI features are optional — they only run when you trigger pricing, description generation, or photo matching.</p>
          </Section>

          <Section title="Data storage & security">
            <p>Your data is stored in Supabase (PostgreSQL) with row-level security — your records are only accessible to your account. Integration credentials are stored encrypted. Photos are stored in private Supabase Storage buckets.</p>
            <p>We use HTTPS for all data in transit. We do not store plaintext passwords.</p>
          </Section>

          <Section title="Your rights">
            <p>You can delete your account and all associated data at any time by contacting us at <a href="mailto:hello@vinylvault.app" className="text-[#8b7fe8] hover:underline">hello@vinylvault.app</a>. Album deletion within the app also permanently removes that record and its associated photos.</p>
          </Section>

          <Section title="Cookies">
            <p>VinylVault uses session cookies set by Supabase for authentication. We do not use tracking or advertising cookies. Theme and sidebar preferences are stored in your browser&apos;s localStorage only.</p>
          </Section>

          <Section title="Changes to this policy">
            <p>We may update this policy as the product evolves. Significant changes will be communicated via email to registered users. Continued use of VinylVault after changes constitutes acceptance of the updated policy.</p>
          </Section>

          <Section title="Contact">
            <p>Questions about this policy? Email <a href="mailto:hello@vinylvault.app" className="text-[#8b7fe8] hover:underline">hello@vinylvault.app</a>.</p>
          </Section>
        </div>
      </div>

      <footer className="relative border-t border-white/[0.06] px-6 py-6 text-center text-sm text-white/30">
        © {new Date().getFullYear()} VinylVault. All rights reserved.
      </footer>
    </div>
  );
}
