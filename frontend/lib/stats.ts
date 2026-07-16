/**
 * Gather the activity snapshot that drives achievements. Every query runs
 * under the caller's RLS, so counts are inherently scoped to their own data.
 * Called from server components (profile page, dashboard).
 */

import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import type { Stats } from "@/lib/badges";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Count rows in a table under RLS (optionally filtered to one status). */
async function count(
  supabase: ServerClient,
  table: string,
  status?: string,
): Promise<number> {
  const base = supabase.from(table).select("*", { count: "exact", head: true });
  const { count: n } = await (status ? base.eq("status", status) : base);
  return n ?? 0;
}

/** Hour-of-day (0-23) of an ISO timestamp in the given IANA zone. */
function hourIn(iso: string, tz: string | null): number {
  const h = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: tz ?? undefined,
  }).format(new Date(iso));
  return Number(h) % 24;
}

export async function gatherStats(profile: Profile): Promise<Stats> {
  const supabase = await createClient();

  const [sessions, exported, patients, appointments, documents, sessionTimes] =
    await Promise.all([
      count(supabase, "sessions"),
      count(supabase, "sessions", "exported"),
      count(supabase, "patients"),
      count(supabase, "appointments"),
      count(supabase, "documents"),
      supabase
        .from("sessions")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(500)
        .returns<{ created_at: string }[]>(),
    ]);

  const nightOwl = (sessionTimes.data ?? []).some((row) => {
    const h = hourIn(row.created_at, profile.timezone);
    return h >= 22 || h < 5;
  });

  return {
    currentStreak: profile.current_streak ?? 0,
    longestStreak: profile.longest_streak ?? 0,
    sessions,
    exported,
    patients,
    appointments,
    documents,
    specializations: profile.specializations?.length ?? 0,
    onboarded: profile.onboarded,
    hasAvatar: Boolean(profile.avatar_id),
    nightOwl,
  };
}
