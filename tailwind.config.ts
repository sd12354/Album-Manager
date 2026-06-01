import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "var(--font-geist-sans)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        playfair: ["var(--font-display)", "sans-serif"],
        inter: ["var(--font-geist-sans)", "sans-serif"],
      },
      colors: {
        base: "#0A0A0B",
        card: {
          DEFAULT: "#111113",
          foreground: "#F5F4F0",
        },
        sidebar: "#0D0D0F",
        input: "#1A1A1C",
        primary: {
          DEFAULT: "#F5F4F0",
          foreground: "#0A0A0B",
        },
        accent: {
          DEFAULT: "#D4A843",
          hover: "#C49833",
          foreground: "#0A0A0B",
        },
        muted: {
          DEFAULT: "#64748B",
          foreground: "#94A3B8",
        },
        border: "rgba(255,255,255,0.08)",
        ring: "#D4A843",
        background: "#0A0A0B",
        foreground: "#F5F4F0",
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#F5F4F0",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
        xl: "0.75rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
