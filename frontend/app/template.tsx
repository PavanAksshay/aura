"use client";

/**
 * Route transition: templates remount on every navigation, so each page gets a
 * coordinated entrance — a soft lift with a whisper of scale and blur clearing,
 * so switching tabs feels like content settling into place rather than a hard
 * cut. Non-blocking; keeps to the app's gentle ease-out rhythm.
 */

import { motion } from "framer-motion";
import { EASE_OUT } from "@/components/motion/primitives";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.985, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="flex min-h-full flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
