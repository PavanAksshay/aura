"use client";

/**
 * Notifies the clinician when they cross a badge threshold. The server passes
 * the badges that are newly satisfied (earned now, not yet persisted); we toast
 * each one and write the full earned set back so the toast fires only once.
 */

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { BADGES } from "@/lib/badges";

const BADGE_NAME = new Map(BADGES.map((b) => [b.id, b.name]));

export function AchievementToaster({
  userId,
  newlyEarned,
  allEarned,
}: {
  userId: string;
  newlyEarned: string[];
  allEarned: string[];
}) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || newlyEarned.length === 0) return;
    done.current = true;

    for (const id of newlyEarned) {
      toast.success("Achievement unlocked 🏆", BADGE_NAME.get(id) ?? "New badge");
    }

    void (async () => {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ earned_badges: allEarned })
        .eq("id", userId);
    })();
  }, [userId, newlyEarned, allEarned]);

  return null;
}
