/** Therapist profile: identity, practice details, stats, and achievements. */

import { redirect } from "next/navigation";
import {
  CalendarClock,
  Flame,
  Mail,
  MapPin,
  Mic,
  Sparkles,
  Trophy,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { computeEarnedBadges } from "@/lib/badges";
import { gatherStats } from "@/lib/stats";
import { AchievementsGrid } from "@/components/profile/AchievementsGrid";
import { PushToggle } from "@/components/profile/PushToggle";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { Stagger, StaggerItem } from "@/components/motion/primitives";

export const metadata = { title: "Profile" };

const EXPERIENCE_LABEL: Record<number, string> = {
  0: "0–2 years",
  3: "3–7 years",
  8: "8–15 years",
  15: "15+ years",
};

/** "yyyy-mm-dd" → a readable date. Parsed as local parts, so no TZ drift. */
function formatDob(ymd: string | null): string | null {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const memberSince = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .maybeSingle<Profile>();

  if (!profile) {
    return (
      <p className="text-destructive">
        Could not load your profile. If you just upgraded, make sure migration
        0010 has been applied.
      </p>
    );
  }

  const stats = await gatherStats(profile);
  const earned = computeEarnedBadges(stats);

  // Resolve a signed URL for the custom profile photo (private bucket), if any.
  let photoUrl: string | null = null;
  if (profile.avatar_url) {
    const { data } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_url, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  const tiles: { icon: LucideIcon; label: string; value: number | string }[] = [
    { icon: Mic, label: "Sessions", value: stats.sessions },
    { icon: UsersRound, label: "Patients", value: stats.patients },
    { icon: CalendarClock, label: "Appointments", value: stats.appointments },
    { icon: Flame, label: "Day streak", value: stats.currentStreak },
  ];

  const details: { label: string; value: string | null }[] = [
    { label: "Professional title", value: profile.title },
    { label: "Gender", value: profile.gender },
    { label: "Date of birth", value: formatDob(profile.date_of_birth) },
    { label: "Practice", value: profile.clinic_name },
    { label: "Practice type", value: profile.practice_type },
    {
      label: "Experience",
      value:
        profile.years_experience !== null
          ? (EXPERIENCE_LABEL[profile.years_experience] ??
            `${profile.years_experience}+ years`)
          : null,
    },
    { label: "Country", value: profile.country },
    { label: "Timezone", value: profile.timezone },
  ];

  return (
    <div>
      <PageHeading
        title="Your"
        accent="profile"
        subtitle="Who you are on Aura — and how far your practice has come."
      />

      <Stagger className="space-y-6">
      <StaggerItem>
      {/* Identity card */}
      <div className="glass flex flex-col gap-6 rounded-3xl p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
        <ProfileAvatar
          userId={user.id}
          avatarId={profile.avatar_id}
          avatarPath={profile.avatar_url}
          photoUrl={photoUrl}
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {profile.full_name || "Your name"}
          </h2>
          {profile.title && (
            <p className="mt-0.5 text-muted-foreground">{profile.title}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex min-w-0 max-w-full items-center gap-1.5">
              <Mail className="size-4 shrink-0" />
              <span className="min-w-0 break-all">{user.email}</span>
            </span>
            {profile.country && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" />
                {profile.country}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-4" />
              Member since {memberSince(profile.created_at)}
            </span>
          </div>
        </div>
        {/* Streak highlight */}
        <div className="flex shrink-0 items-center gap-5 rounded-md border border-border bg-card px-5 py-3 text-foreground">
          <div className="text-center">
            <p className="flex items-center justify-center gap-1 font-mono text-2xl font-bold text-foreground">
              <Flame className="size-5 text-amber-500" />
              {stats.currentStreak}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Day streak
            </p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="flex items-center justify-center gap-1 font-mono text-2xl font-bold text-foreground">
              <Trophy className="size-5 text-yellow-500" />
              {stats.longestStreak}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Best
            </p>
          </div>
        </div>
      </div>
      </StaggerItem>

      <StaggerItem>
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(({ icon, label, value }) => (
          <StatCard key={label} icon={icon} label={label} value={value} />
        ))}
      </div>
      </StaggerItem>

      <StaggerItem>
      {/* Details + specializations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-5">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground border-b border-border pb-2">
            Practice details
          </h3>
          <dl className="space-y-2.5">
            {details.map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-border/50 pb-2 last:border-0 last:pb-0"
              >
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-right text-xs font-semibold text-foreground">
                  {value || <span className="text-muted-foreground/60">—</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-md border border-border bg-card p-5">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground border-b border-border pb-2">
            Specializations
          </h3>
          {profile.specializations.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {profile.specializations.map((s) => (
                <span
                  key={s}
                  className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              None added yet — you can update these any time.
            </p>
          )}
        </div>
      </div>

      </StaggerItem>

      <StaggerItem>
        {/* Install as an app + background reminders opt-in */}
        <div className="grid gap-4 lg:grid-cols-2">
          <InstallPrompt />
          <PushToggle userId={user.id} />
        </div>
      </StaggerItem>

      <StaggerItem>
        {/* Achievements */}
        <AchievementsGrid earned={earned} />
      </StaggerItem>
      </Stagger>
    </div>
  );
}
