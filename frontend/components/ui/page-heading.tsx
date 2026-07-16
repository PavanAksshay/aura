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
  const words = title.split(" ");
  return (
    <div className="mb-10">
      <motion.h1
        variants={container}
        initial="hidden"
        animate="visible"
        className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl"
      >
        {words.map((w, i) => (
          <motion.span key={i} variants={word} className="inline-block">
            {w}
            {" "}
          </motion.span>
        ))}
        {accent ? (
          <motion.span variants={word} className="text-gradient inline-block">
            {accent}
          </motion.span>
        ) : null}
      </motion.h1>
      {subtitle ? (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.28 }}
          className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-foreground/70 sm:text-lg"
        >
          {subtitle}
        </motion.p>
      ) : null}
    </div>
  );
}
