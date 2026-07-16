"use client";

/**
 * Count-up number (adapted from magicui's Number Ticker to Aura's motion
 * vocabulary): eases from 0 to the target when it enters the viewport.
 * Skipped entirely under prefers-reduced-motion — the value just renders.
 */

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

import { EASE_OUT } from "@/components/motion/primitives";

export function NumberTicker({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const format = (n: number) => Intl.NumberFormat().format(Math.round(n));

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView || reduced || value === 0) return;
    const controls = animate(0, value, {
      duration: 0.9,
      ease: EASE_OUT,
      onUpdate: (latest) => {
        el.textContent = format(latest);
      },
    });
    return () => controls.stop();
  }, [inView, reduced, value]);

  return (
    <span ref={ref} className={className}>
      {/* Server-rendered final value: correct without JS, replaced by the
          count-up on view. */}
      {format(value)}
    </span>
  );
}
