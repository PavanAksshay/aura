"use client";

/**
 * Shared page title in the landing-hero type style — Sora display, tight
 * tracking, optional gradient accent word. The title animates in word-by-word
 * (rise + blur-clear) and the subtitle follows, so text appears dynamically on
 * every tab switch (templates remount on navigation), mirroring the landing.
 */

import { motion, type Variants } from "framer-motion";
import { EASE_OUT } from "@/components/motion/primitives";

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

const word: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE_OUT },
  },
};

export function PageHeading({
  title,
  accent,
  subtitle,
}: {
  title: string;
  accent?: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8 border-b border-border pb-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {title}{" "}
        {accent ? (
          <span className="text-foreground/80">{accent}</span>
        ) : null}
      </h1>
      {subtitle ? (
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
