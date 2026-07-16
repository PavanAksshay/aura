"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Selectable pill used in the onboarding steps. Selection is conveyed by
 * color AND a check glyph (never color alone), with a satisfying tap scale.
 */
export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary/60 bg-primary/15 text-primary shadow-[0_0_20px_-6px] shadow-primary/50"
          : "glass-subtle text-muted-foreground hover:border-foreground/20 hover:text-foreground",
        className,
      )}
    >
      {selected && <Check className="size-3.5" />}
      {children}
    </motion.button>
  );
}
