"use client";

/**
 * The 25-badge achievement wall. Earned badges bloom in with their tier
 * colour; locked ones sit dimmed with a lock and the criteria to unlock them.
 * Tasteful tints only — no glow/neon.
 */

import { motion } from "framer-motion";
import { Lock } from "lucide-react";

import { BADGES, type BadgeTier } from "@/lib/badges";
import { EASE_OUT } from "@/components/motion/primitives";

const TIER_STYLE: Record<BadgeTier, { chip: string; ring: string; label: string }> = {
  bronze: {
    chip: "bg-amber-500/15 text-amber-700",
    ring: "border-amber-500/30",
    label: "Bronze",
  },
  silver: {
    chip: "bg-slate-400/20 text-slate-600",
    ring: "border-slate-400/30",
    label: "Silver",
  },
  gold: {
    chip: "bg-yellow-500/15 text-yellow-700",
    ring: "border-yellow-500/35",
    label: "Gold",
  },
  special: {
    chip: "bg-primary/15 text-primary",
    ring: "border-primary/35",
    label: "Special",
  },
};

export function AchievementsGrid({ earned }: { earned: string[] }) {
  const earnedSet = new Set(earned);
  const count = BADGES.filter((b) => earnedSet.has(b.id)).length;

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Achievements
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Badges you earn as your practice grows on Aura.
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-semibold tabular-nums">
            {count}
            <span className="text-muted-foreground">/{BADGES.length}</span>
          </p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            unlocked
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {BADGES.map((badge, i) => {
          const isEarned = earnedSet.has(badge.id);
          const tier = TIER_STYLE[badge.tier];
          const Icon = badge.icon;
          return (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT, delay: Math.min(i * 0.03, 0.6) }}
              className={`relative flex flex-col rounded-2xl border p-4 transition-colors ${
                isEarned
                  ? `glass ${tier.ring}`
                  : "glass-subtle border-border opacity-70 grayscale"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div
                  className={`flex size-10 items-center justify-center rounded-xl ${
                    isEarned ? tier.chip : "bg-foreground/8 text-muted-foreground"
                  }`}
                >
                  {isEarned ? (
                    <Icon className="size-5" />
                  ) : (
                    <Lock className="size-4" />
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${
                    isEarned ? tier.chip : "bg-foreground/8 text-muted-foreground"
                  }`}
                >
                  {tier.label}
                </span>
              </div>
              <p className="font-medium leading-snug">{badge.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {badge.description}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
