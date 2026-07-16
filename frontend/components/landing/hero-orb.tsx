"use client";

/**
 * Client-only loader for the WebGL orb. Keeps three.js out of the initial
 * bundle and out of SSR, and — critically — unmounts the render loop the
 * moment the hero scrolls out of view so the rest of the page never pays
 * for it. A soft radial glow holds the space while loading / unmounted.
 */

import dynamic from "next/dynamic";
import { useRef } from "react";
import { useInView } from "framer-motion";

const GLOW = (
  <div className="size-full rounded-full bg-[radial-gradient(circle,oklch(0.8_0.13_210_/_14%),transparent_70%)]" />
);

const AuraOrb = dynamic(() => import("@/components/three/aura-orb"), {
  ssr: false,
  loading: () => GLOW,
});

export function HeroOrb({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Small negative margin: tear down shortly after leaving, not mid-exit.
  const inView = useInView(ref, { margin: "80px" });

  return (
    <div ref={ref} className={className} aria-hidden>
      {inView ? <AuraOrb /> : GLOW}
    </div>
  );
}
