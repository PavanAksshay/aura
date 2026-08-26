"use client";

/**
 * The 25-badge achievement wall. Earned badges bloom in with their tier
 * colour; locked ones sit dimmed with a lock and the criteria to unlock them.
 * Tasteful tints only — no glow/neon.
 */

import { useState } from "react";
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
  const [showAll, setShowAll] = useState(false);

  const displayedBadges = showAll
    ? BADGES
    : BADGES.filter((b) => earnedSet.has(b.id));

  return (
    <div className="rounded-md border border-border bg-card p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Achievements
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Badges earned as your clinical practice grows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="font-mono text-base font-bold text-foreground">
              {count}
            </span>
            <span className="font-mono text-xs text-muted-foreground">/{BADGES.length}</span>
            <span className="ml-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              unlocked
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-muted/80"
          >
            {showAll ? "Show earned only" : `View all (${BADGES.length})`}
          </button>
        </div>
      </div>

      {displayedBadges.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No badges unlocked yet. Complete your first session to earn a badge!
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {displayedBadges.map((badge, i) => {
            const isEarned = earnedSet.has(badge.id);
            const tier = TIER_STYLE[badge.tier];
            const Icon = badge.icon;
            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT, delay: Math.min(i * 0.02, 0.4) }}
                className={`relative flex flex-col rounded-md border p-3.5 transition-colors ${
                  isEarned
                    ? `bg-card ${tier.ring}`
                    : "bg-muted/30 border-border opacity-60"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div
                    className={`flex size-7 items-center justify-center rounded-md ${
                      isEarned ? tier.chip : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {isEarned ? (
                      <Icon className="size-3.5" />
                    ) : (
                      <Lock className="size-3" />
                    )}
                  </div>
                  <span
                    className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase ${
                      isEarned ? tier.chip : "border-border text-muted-foreground"
                    }`}
                  >
                    {tier.label}
                  </span>
                </div>
                <p className="text-xs font-bold text-foreground">{badge.name}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {badge.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
