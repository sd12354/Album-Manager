"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "vinylvault.intro.played";
const VISIBLE_MS = 2200; // total time the intro stays fully shown
const FADE_MS = 600; // fade-out duration

/**
 * Full-screen homepage preloader: a vinyl record spins up, the brand fades in,
 * and a progress bar fills before the whole overlay dissolves to reveal the
 * landing page. Plays once per browser session to avoid nagging on every
 * client-side navigation back to home.
 */
export function HomeIntro() {
  // Start as null so SSR and first client render match (avoids hydration flash);
  // decide whether to show only after mount.
  const [phase, setPhase] = useState<"hidden" | "playing" | "leaving">("hidden");

  useEffect(() => {
    let alreadyPlayed = false;
    try {
      alreadyPlayed = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // sessionStorage unavailable (private mode) — just play it.
    }
    if (alreadyPlayed) return;

    setPhase("playing");
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }

    const leaveTimer = setTimeout(() => setPhase("leaving"), VISIBLE_MS);
    const doneTimer = setTimeout(
      () => setPhase("hidden"),
      VISIBLE_MS + FADE_MS
    );

    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      className={`vv-intro ${phase === "leaving" ? "vv-intro--leaving" : ""}`}
      aria-hidden="true"
    >
      <div className="vv-intro__stage">
        {/* Spinning record */}
        <div className="vv-intro__disc">
          <svg viewBox="0 0 200 200" className="vv-intro__svg">
            <defs>
              <radialGradient id="vvSheen" cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                <stop offset="35%" stopColor="rgba(255,255,255,0.02)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
            </defs>
            {/* Vinyl body */}
            <circle cx="100" cy="100" r="96" fill="#0b0b0d" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            {/* Grooves */}
            {[88, 80, 72, 64, 56, 48, 40].map((r) => (
              <circle
                key={r}
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
            ))}
            {/* Label */}
            <circle cx="100" cy="100" r="30" fill="#8b7fe8" />
            <circle cx="100" cy="100" r="30" fill="url(#vvSheen)" />
            <circle cx="100" cy="100" r="4" fill="#0b0b0d" />
            {/* Sheen sweep across the whole disc */}
            <circle cx="100" cy="100" r="96" fill="url(#vvSheen)" />
          </svg>
        </div>

        <p className="vv-intro__brand">VinylVault</p>

        <div className="vv-intro__bar">
          <span className="vv-intro__bar-fill" />
        </div>
      </div>

      <style>{`
        .vv-intro {
          position: fixed;
          inset: 0;
          z-index: 100000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 50% 40%, #101014 0%, #050507 60%, #030304 100%);
          opacity: 1;
          transition: opacity ${FADE_MS}ms ease, visibility ${FADE_MS}ms ease;
        }
        .vv-intro--leaving {
          opacity: 0;
          visibility: hidden;
        }
        .vv-intro__stage {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 22px;
        }
        .vv-intro__disc {
          width: 132px;
          height: 132px;
          animation: vvDiscIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
          filter: drop-shadow(0 0 30px rgba(139,127,232,0.25));
        }
        .vv-intro__svg {
          width: 100%;
          height: 100%;
          transform-origin: 50% 50%;
          animation: vvSpin 1.1s linear infinite;
        }
        .vv-intro__brand {
          font-family: var(--font-display), ui-sans-serif, system-ui, sans-serif;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: #f5f4f0;
          opacity: 0;
          animation: vvFadeUp 0.6s ease 0.25s both;
        }
        .vv-intro__bar {
          width: 160px;
          height: 3px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
          opacity: 0;
          animation: vvFadeUp 0.6s ease 0.35s both;
        }
        .vv-intro__bar-fill {
          display: block;
          height: 100%;
          width: 0%;
          border-radius: 999px;
          background: linear-gradient(90deg, #6d5fc4, #8b7fe8, #c3b6f5);
          animation: vvBar 1.7s cubic-bezier(0.65, 0, 0.35, 1) 0.3s forwards;
        }
        @keyframes vvSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes vvDiscIn {
          0% { opacity: 0; transform: scale(0.6); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes vvFadeUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes vvBar {
          0% { width: 0%; }
          70% { width: 88%; }
          100% { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vv-intro__svg { animation: none; }
          .vv-intro__disc { animation: vvFadeUp 0.4s ease both; }
          .vv-intro__bar-fill { animation: vvBar 0.8s ease forwards; }
        }
      `}</style>
    </div>
  );
}
