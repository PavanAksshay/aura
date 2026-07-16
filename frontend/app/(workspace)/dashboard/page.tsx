/** Dashboard: a bento command center — greeting, capture CTA, stats, activity. */

import Link from "next/link";
import {
  AudioLines,
  BrainCircuit,
  CalendarClock,
  Mic,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { ClinicalSession, Profile } from "@/lib/types";
import { Badge, SESSION_STATUS_TONE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/primitives";
import { StatCard } from "@/components/ui/stat-card";

type SessionRow = Pick<
  ClinicalSession,
  "id" | "title" | "status" | "created_at"
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

  const [profileQ, recent, totalQ, weekQ, patientsQ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, timezone")
      .maybeSingle<Pick<Profile, "full_name" | "timezone">>(),
    supabase
      .from("sessions")
      .select("id, title, status, created_at")
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<SessionRow[]>(),
    supabase.from("sessions").select("id", { count: "exact", head: true }),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    supabase.from("patients").select("id", { count: "exact", head: true }),
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

  return (
    <div>
      {/* Greeting — hero scale, matching the page headings on other tabs */}
      <FadeIn className="mb-9">
        <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          {greeting(profileQ.data?.timezone ?? null)}
          {firstName ? (
            <span className="text-gradient">, {firstName}</span>
          ) : null}
          .
        </h1>
        <p className="mt-3 max-w-2xl text-base font-medium leading-relaxed text-foreground/70 sm:text-lg">
          <span className="text-foreground/85">{todayLabel()}</span>
          {" · "}
          Here&apos;s your practice at a glance.
        </p>
      </FadeIn>

      {/* Stats row across the top */}
      <Stagger className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map(({ icon, label, value }) => (
          <StaggerItem key={label}>
            <StatCard icon={icon} label={label} value={value} />
          </StaggerItem>
        ))}
      </Stagger>

      <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Capture CTA — the hero tile */}
        <StaggerItem className="lg:col-span-8">
          <Link
            href="/sessions/new"
            className="group relative flex h-full min-h-56 flex-col justify-between overflow-hidden rounded-3xl bg-linear-140 from-aurora-cyan/90 via-aurora-teal/85 to-aurora-violet/80 p-8 text-primary-foreground shadow-[0_20px_50px_-20px] shadow-primary/60"
          >
            <div
              aria-hidden
              className="absolute -right-10 -top-10 size-40 rounded-full bg-primary-foreground/10 blur-2xl"
            />
            <div className="relative flex size-12 items-center justify-center rounded-2xl bg-primary-foreground/15">
              <Mic className="size-6" />
            </div>
            <div className="relative">
              <h2 className="font-display text-3xl font-bold">Start a session</h2>
              <p className="mt-2 max-w-sm text-sm text-primary-foreground/80">
                Record, and Aura drafts the note. The audio never persists.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium transition-transform group-hover:translate-x-1">
                Record now →
              </span>
            </div>
          </Link>
        </StaggerItem>

        {/* Right rail: quick actions + tip */}
        <StaggerItem className="lg:col-span-4">
          <div className="flex h-full flex-col gap-4">
            <div className="glass rounded-3xl p-6">
              <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Quick actions
              </h2>
              <div className="space-y-2">
                <Button asChild variant="secondary" className="w-full justify-start">
                  <Link href="/patients">
                    <UsersRound />
                    Add a patient
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="w-full justify-start">
                  <Link href="/memory">
                    <BrainCircuit />
                    Search patient memory
                  </Link>
                </Button>
              </div>
            </div>

            <div className="glass relative flex-1 overflow-hidden rounded-3xl p-6">
              <Sparkles className="mb-3 size-5 text-accent" />
              <p className="font-display text-base italic leading-relaxed text-foreground/80">
                {tip}
              </p>
            </div>
          </div>
        </StaggerItem>

        {/* Recent sessions — full width */}
        <StaggerItem className="lg:col-span-12">
          <div className="glass h-full rounded-3xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Recent sessions
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/patients">View patients</Link>
              </Button>
            </div>

            {sessions.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <AudioLines className="size-6" />
                </div>
                <p className="mt-4 font-medium">No sessions yet</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Record your first session and it will appear here.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/sessions/${s.id}`}
                      className="group flex items-center justify-between rounded-2xl px-4 py-3 transition-colors hover:bg-foreground/[0.04]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium transition-colors group-hover:text-primary">
                          {s.title}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {new Date(s.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge tone={SESSION_STATUS_TONE[s.status]}>
                        {s.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </StaggerItem>
      </Stagger>
    </div>
  );
}
