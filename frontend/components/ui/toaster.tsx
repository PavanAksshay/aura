"use client";

/**
 * Renders the global toast queue. Mounted once in the root layout. Toasts
 * slide in bottom-right, are dismissible, and announce politely to screen
 * readers via aria-live.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import {
  dismissToast,
  subscribeToasts,
  type ToastItem,
  type ToastVariant,
} from "@/lib/toast";
import { EASE_OUT } from "@/components/motion/primitives";

const ICON: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const ACCENT: Record<ToastVariant, string> = {
  success: "text-primary",
  error: "text-destructive",
  info: "text-accent",
};

/** Wall-clock time the toast was raised (kept out of render for purity). */
function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const Icon = ICON[t.variant];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.2, right: 0.9 }}
              dragSnapToOrigin
              onDragEnd={(_, info) => {
                // Swipe right (toward the screen edge) to dismiss.
                if (info.offset.x > 90 || info.velocity.x > 500) {
                  dismissToast(t.id);
                }
              }}
              className="glass pointer-events-auto flex items-start gap-3 rounded-2xl p-4 active:cursor-grabbing"
            >
              <Icon className={`mt-0.5 size-5 shrink-0 ${ACCENT[t.variant]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
                    {formatTime(t.createdAt)}
                  </span>
                </div>
                {t.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss"
                className="cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
