/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
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
