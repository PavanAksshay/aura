"use client";

/**
 * The app's first-load splash.
 *
 * Placed as the first child of <body> so it is in the server-rendered HTML and
 * covers the screen from the first paint — styled by the critical CSS inlined
 * in <head> (see lib/splash.ts), not by the bundle, so it appears even before
 * the stylesheet loads. It matters most on a cold PWA launch and on slow
 * phones, where the screen would otherwise be blank while the app boots.
 *
 * It removes itself once hydration has run (this effect firing is that signal),
 * fonts are ready (so the wordmark does not swap typeface mid-fade), and a
 * short minimum has elapsed (so a fast load reads as a deliberate splash, not
 * a flash). Nothing here blocks interaction — the app underneath is already
 * live; the splash is only a cover that fades away.
 */

import { useEffect, useState } from "react";

// Long enough to read as intentional, short enough not to feel like a wait.
const MIN_VISIBLE_MS = 550;
const FADE_MS = 450;
// A font that never resolves must not pin the splash open forever.
const FONT_WAIT_CAP_MS = 2000;

type Phase = "visible" | "hiding" | "gone";

export function AppSplash() {
  const [phase, setPhase] = useState<Phase>("visible");

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;
    let goneTimer: ReturnType<typeof setTimeout>;

    const fontsReady =
      typeof document !== "undefined" && "fonts" in document
        ? document.fonts.ready
        : Promise.resolve();
    const capped = Promise.race([
      fontsReady,
      new Promise((resolve) => setTimeout(resolve, FONT_WAIT_CAP_MS)),
    ]);

    capped.then(() => {
      hideTimer = setTimeout(() => {
        setPhase("hiding");
        goneTimer = setTimeout(() => setPhase("gone"), FADE_MS);
      }, MIN_VISIBLE_MS);
    });

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(goneTimer);
    };
  }, []);

  // Once faded, drop it from the tree entirely so it can never trap a click.
  if (phase === "gone") return null;

  return (
    <div
      className="aura-splash"
      data-hidden={phase === "hiding"}
      role="status"
      aria-label="Loading Aura"
    >
      <div className="aura-splash__brand">
        {/* Gradient hard-coded rather than via CSS vars: the splash must render
            before globals.css defines --aurora-*, or the mark would be blank. */}
        <svg
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
          className="aura-splash__mark"
        >
          <defs>
            <linearGradient
              id="aura-splash-g"
              gradientUnits="userSpaceOnUse"
              x1="4"
              y1="28"
              x2="28"
              y2="4"
            >
              <stop offset="0%" stopColor="oklch(0.6 0.12 180)" />
              <stop offset="55%" stopColor="oklch(0.6 0.11 220)" />
              <stop offset="100%" stopColor="oklch(0.55 0.17 295)" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="4" fill="url(#aura-splash-g)" />
          <path
            d="M16 5.5a10.5 10.5 0 0 1 10.5 10.5"
            stroke="url(#aura-splash-g)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M16 26.5A10.5 10.5 0 0 1 5.5 16"
            stroke="url(#aura-splash-g)"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.55"
          />
        </svg>
        <span className="aura-splash__word">aura</span>
      </div>
      <div className="aura-splash__spinner" aria-hidden="true" />
    </div>
  );
}
