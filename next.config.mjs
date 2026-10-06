// Album photos are served from Supabase Storage and/or Cloudflare R2. The R2
// public URL is either a Cloudflare-managed *.r2.dev address or a custom
// domain; allow whichever host R2_PUBLIC_URL names so next/image can optimise
// thumbnails from it.
const remotePatterns = [
  { protocol: "https", hostname: "*.supabase.co" },
  { protocol: "https", hostname: "*.r2.dev" },
];
try {
  const r2PublicUrl = (process.env.R2_PUBLIC_URL ?? "").trim();
  if (r2PublicUrl) {
    const { hostname } = new URL(r2PublicUrl);
    if (!hostname.endsWith(".r2.dev")) {
      remotePatterns.push({ protocol: "https", hostname });
    }
  }
} catch {
  // Malformed R2_PUBLIC_URL: lib/r2-core.ts treats R2 as not configured too.
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns,
    // Hold optimized images in Vercel's edge cache for a full year. The
    // default (60s) means a popular photo gets re-fetched from Supabase
    // hundreds of times a day — main driver of free-tier egress. Photo
    // upload paths already include a timestamp + random suffix, so a
    // "modified" photo gets a new URL anyway; we never need to invalidate
    // the same URL.
    minimumCacheTTL: 31536000,
    // Prefer modern formats when the browser supports them. AVIF is
    // typically ~40% smaller than JPEG at equivalent quality, so a single
    // album cover served at 88-1920px drops from ~150KB to ~80KB on
    // average — direct halving of egress on the proxy-to-browser hop.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
