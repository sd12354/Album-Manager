/**
 * Confetti celebration helpers.
 *
 * canvas-confetti is lazy-loaded so the ~10KB only ships to pages that
 * actually fire a celebration. Localstorage flags make milestone moments
 * (first sale, first listing, etc.) one-shot — we don't want to dump
 * confetti every time the user marks a record sold.
 */

const FIRST_SALE_KEY = "vinylvault.firstSale.celebrated";
const FIRST_LISTING_KEY = "vinylvault.firstListing.celebrated";

/** Whether a milestone celebration has already played. SSR-safe. */
export function hasCelebrated(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return true; // be conservative if storage is unavailable
  }
}

function markCelebrated(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Private-mode Safari etc. — non-fatal, the worst case is the
    // celebration replays next session.
  }
}

/**
 * Fire a multi-burst confetti animation roughly centered above the
 * fold. Safe to call multiple times; each call is independent.
 */
export async function fireConfetti() {
  if (typeof window === "undefined") return;
  try {
    const { default: confetti } = await import("canvas-confetti");

    // Mid-air central burst — primary visual.
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.35 },
      colors: ["#8b7fe8", "#facc15", "#34d399", "#f472b6", "#60a5fa"],
    });

    // Side cannons for a fuller effect.
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.7 },
        colors: ["#8b7fe8", "#facc15"],
      });
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.7 },
        colors: ["#34d399", "#60a5fa"],
      });
    }, 200);
  } catch {
    // Confetti is decorative; never let a load failure cascade.
  }
}

/**
 * One-shot first-sale celebration. Returns true if the celebration ran
 * (so the caller can stack a special toast on top), false if the user
 * had already seen it on this device.
 */
export async function celebrateFirstSale(): Promise<boolean> {
  if (hasCelebrated(FIRST_SALE_KEY)) return false;
  markCelebrated(FIRST_SALE_KEY);
  await fireConfetti();
  return true;
}

/**
 * One-shot first-listing celebration. Same one-shot semantics as the
 * first-sale celebration, with a slightly more restrained burst — first
 * listing is a milestone but it's not money in hand yet, so we don't
 * want to upstage the eventual first-sale moment.
 */
export async function celebrateFirstListing(): Promise<boolean> {
  if (hasCelebrated(FIRST_LISTING_KEY)) return false;
  markCelebrated(FIRST_LISTING_KEY);
  try {
    const { default: confetti } = await import("canvas-confetti");
    // Gentler than the first-sale firework: one upward fountain in the
    // brand accent only.
    confetti({
      particleCount: 80,
      spread: 60,
      startVelocity: 35,
      ticks: 200,
      origin: { y: 0.4 },
      colors: ["#8b7fe8", "#a594f5", "#cfc7ff"],
    });
  } catch {
    // Decorative — never break the listing UX.
  }
  return true;
}
