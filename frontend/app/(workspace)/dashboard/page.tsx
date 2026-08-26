/** Dashboard: a bento command center — greeting, capture CTA, stats, activity. */

import Link from "next/link";
import {
  AudioLines,
  BadgeCheck,
  BrainCircuit,
  CalendarClock,
  Mic,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { ClinicalSession, Profile } from "@/lib/types";
import {
  Badge,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_TONE,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/primitives";
import { StatCard } from "@/components/ui/stat-card";

type SessionRow = Pick<
  ClinicalSession,
  "id" | "title" | "status" | "created_at" | "reviewed_at"
>;

const TIPS = [
  "“The good life is a process, not a state of being.” — Carl Rogers",
  "“People will forget what you said, but never how you made them feel.” — Maya Angelou",
  "“The privilege of a lifetime is to become who you truly are.” — Carl Jung",
  "“What we don't need in the presence of a good listener is more advice.” — Anonymous",
];

/** Impure time helpers kept out of the render body (react-hooks/purity). */
function weekAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function dailyTip(): string {
  return TIPS[new Date().getDay() % TIPS.length] ?? TIPS[0]!;
}

function greeting(tz: string | null): string {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: tz ?? undefined,
  }).format(new Date());
  const hour = Number(hourStr);
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const weekAgo = weekAgoIso();

  const [profileQ, recent, totalQ, weekQ, patientsQ, unreviewedQ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, timezone")
        .maybeSingle<Pick<Profile, "full_name" | "timezone">>(),
      supabase
        .from("sessions")
        .select("id, title, status, created_at, reviewed_at")
        .order("created_at", { ascending: false })
        .limit(6)
        .returns<SessionRow[]>(),
      supabase.from("sessions").select("id", { count: "exact", head: true }),
      supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo),
      supabase.from("patients").select("id", { count: "exact", head: true }),
      // Notes nobody has verified yet. Auto-export means these are already in
      // Memory and already readable as if they were records, so the count is
      // the honest measure of how much unchecked machine output is in play.
      // Hits sessions_unreviewed_idx (migration 0017).
      supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .is("reviewed_at", null)
        .eq("status", "exported"),
    ]);

  const firstName =
    profileQ.data?.full_name?.trim().split(/\s+/).slice(-1)[0] ?? "";
  const tip = dailyTip();

  const stats = [
    { icon: AudioLines, label: "Sessions", value: totalQ.count ?? 0 },
    { icon: CalendarClock, label: "This week", value: weekQ.count ?? 0 },
    { icon: UsersRound, label: "Patients", value: patientsQ.count ?? 0 },
  ];

  const sessions = recent.data ?? [];
  const unreviewed = unreviewedQ.count ?? 0;

  return (
    <div className="space-y-4">
      {/* Greeting Header with inline CTA */}
      <FadeIn className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {greeting(profileQ.data?.timezone ?? null)}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-mono text-foreground/80">{todayLabel()}</span>
            {" · "}

          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href="/sessions/new">
              <Mic className="size-3.5" />
              New Session
            </Link>
          </Button>
        </div>
      </FadeIn>

      {/* Unreviewed notes alert */}
      {unreviewed > 0 && (
        <FadeIn>
          <Link
            href="/patients"
            className="flex items-center gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 transition-colors hover:bg-amber-500/10"
          >
            <BadgeCheck
              aria-hidden
              className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
            />
            <p className="min-w-0 flex-1 text-xs text-foreground">
              <strong className="font-semibold">
                {unreviewed} {unreviewed === 1 ? "note" : "notes"} awaiting review
              </strong>{" "}
              — Verify clinical details before export.
            </p>
          </Link>
        </FadeIn>
      )}

      {/* Compact Stats Grid */}
      <Stagger className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map(({ icon, label, value }) => (
          <StaggerItem key={label}>
            <StatCard icon={icon} label={label} value={value} />
          </StaggerItem>
        ))}
      </Stagger>

      {/* Main Grid: Recent Sessions (8 cols) + Quick Actions (4 cols) */}
      <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <StaggerItem className="lg:col-span-8">
          <div className="rounded-md border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Recent Sessions
              </h2>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2">
                <Link href="/patients">View all →</Link>
              </Button>
            </div>

            {sessions.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <AudioLines className="size-4" />
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">No sessions recorded yet</p>
                <p className="mt-0.5 max-w-xs text-[11px] text-muted-foreground">
                  Start a new recording to capture your first clinical note.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/sessions/${s.id}`}
                    className="flex items-center justify-between py-2.5 px-2 transition-colors hover:bg-muted/40 rounded-sm"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {s.title}
                      </p>
                      <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                        {new Date(s.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge tone={SESSION_STATUS_TONE[s.status]}>
                      {SESSION_STATUS_LABEL[s.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </StaggerItem>

        <StaggerItem className="lg:col-span-4">
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-border bg-card p-4">
              <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="justify-start h-8 text-xs"
                >
                  <Link href="/sessions/new">
                    <Mic className="size-3.5" />
                    Start Session Recording
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="justify-start h-8 text-xs"
                >
                  <Link href="/patients">
                    <UsersRound className="size-3.5" />
                    Patient Directory
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="justify-start h-8 text-xs"
                >
                  <Link href="/memory">
                    <BrainCircuit className="size-3.5" />
                    Search Clinical Memory
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-border bg-card p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                Privacy Status
              </h2>
              <div className="space-y-1.5 text-xs text-muted-foreground leading-normal">
                <p>• Local transcription on your machine.</p>
                <p>• Raw audio deleted on job completion.</p>
                <p>• Notes row-level isolated in Postgres.</p>
              </div>
            </div>
          </div>
        </StaggerItem>
      </Stagger>
    </div>
  );
}
