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
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {selected && <Check className="size-3.5" />}
      {children}
    </motion.button>
  );
}
