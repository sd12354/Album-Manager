"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Three-layer custom cursor for the landing page:
 *  1. Dot    — follows instantly, mix-blend-mode:difference inverts colour under it
 *  2. Ring   — lerped (0.13), SVG turbulence filter on its edge → organic / wavy border
 *  3. Blob   — slow lerp (0.055), large radial glow, acts as a "spotlight magnifier"
 *
 * Only active on pointer:fine (mouse) devices. Falls back to native cursor on touch.
 */
export function CursorEffect() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const blobRef = useRef<HTMLDivElement>(null);
  const [hoverKind, setHoverKind] = useState<"none" | "link" | "hero">("none");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Touch devices — do nothing
    if (window.matchMedia("(pointer: coarse)").matches) return;

    setMounted(true);

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx, ry = my;
    let bx = mx, by = my;
    let raf = 0;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;

      // Instant dot
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
      }

      // Classify what's under cursor
      const el = document.elementFromPoint(mx, my) as HTMLElement | null;
      const isLink  = !!el?.closest("a, button, [role='button']");
      const isHero  = !!el?.closest("[data-cursor-hero]");
      setHoverKind(isHero ? "hero" : isLink ? "link" : "none");
    };

    function tick() {
      rx = lerp(rx, mx, 0.13);
      ry = lerp(ry, my, 0.13);
      bx = lerp(bx, mx, 0.055);
      by = lerp(by, my, 0.055);

      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      }
      if (blobRef.current) {
        blobRef.current.style.transform = `translate(${bx}px,${by}px) translate(-50%,-50%)`;
      }
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!mounted) return null;

  const isLink = hoverKind === "link";
  const isHero = hoverKind === "hero";

  // Ring size & style based on context
  const ringSize   = isHero ? 90 : isLink ? 58 : 38;
  const ringBorder = isHero
    ? "2px solid rgba(212,168,67,0.9)"
    : isLink
      ? "1.5px solid rgba(212,168,67,0.7)"
      : "1.5px solid rgba(212,168,67,0.45)";
  const ringBg = isHero
    ? "rgba(212,168,67,0.06)"
    : "transparent";
  const ringFilter = isHero
    ? "url(#cursor-liquid) brightness(1.15)"
    : "url(#cursor-liquid)";

  // Blob size & opacity
  const blobSize    = isHero ? 260 : isLink ? 180 : 160;
  const blobOpacity = isHero ? 0.22 : isLink ? 0.16 : 0.11;

  return (
    <>
      {/* SVG filter — organic/liquid edge on the ring */}
      <svg style={{ position: "fixed", width: 0, height: 0, overflow: "hidden" }}>
        <defs>
          <filter id="cursor-liquid" x="-40%" y="-40%" width="180%" height="180%">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.035"
              numOctaves="3"
              result="noise"
              seed="4"
            >
              {/* Animate the turbulence seed so the edge is always in motion */}
              <animate
                attributeName="baseFrequency"
                values="0.025;0.04;0.025"
                dur="6s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={isHero ? 14 : isLink ? 10 : 7}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Layer 1 — dot (instant, blend:difference) */}
      <div
        ref={dotRef}
        style={{
          position: "fixed",
          top: 0, left: 0,
          width: isLink ? 10 : 7,
          height: isLink ? 10 : 7,
          borderRadius: "50%",
          background: "#D4A843",
          mixBlendMode: "difference",
          pointerEvents: "none",
          zIndex: 10000,
          transition: "width 0.2s, height 0.2s",
          willChange: "transform",
        }}
      />

      {/* Layer 2 — ring (lerp 0.13, SVG distort filter) */}
      <div
        ref={ringRef}
        style={{
          position: "fixed",
          top: 0, left: 0,
          width: ringSize,
          height: ringSize,
          borderRadius: "50%",
          border: ringBorder,
          background: ringBg,
          backdropFilter: isHero ? "brightness(1.18) contrast(1.08) saturate(1.2)" : "none",
          WebkitBackdropFilter: isHero ? "brightness(1.18) contrast(1.08) saturate(1.2)" : "none",
          filter: ringFilter,
          pointerEvents: "none",
          zIndex: 9999,
          transition: "width 0.35s cubic-bezier(0.34,1.56,0.64,1), height 0.35s cubic-bezier(0.34,1.56,0.64,1), border 0.3s, background 0.3s",
          willChange: "transform",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isHero && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "rgba(212,168,67,0.85)",
            textTransform: "uppercase",
            userSelect: "none",
            fontFamily: "sans-serif",
          }}>
            explore
          </span>
        )}
      </div>

      {/* Layer 3 — slow glow blob (magnifier spotlight) */}
      <div
        ref={blobRef}
        style={{
          position: "fixed",
          top: 0, left: 0,
          width: blobSize,
          height: blobSize,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(212,168,67,${blobOpacity}) 0%, transparent 70%)`,
          pointerEvents: "none",
          zIndex: 9998,
          transition: "width 0.6s ease, height 0.6s ease, opacity 0.4s ease",
          willChange: "transform",
        }}
      />
    </>
  );
}
