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
            <span className="flex items-center gap-1.5">
              <Mail className="size-4" />
              {user.email}
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
        {/* Streak highlight — carries the dashboard's signature gradient */}
        <div className="flex shrink-0 items-center gap-6 rounded-2xl bg-linear-140 from-aurora-cyan/90 via-aurora-teal/85 to-aurora-violet/80 px-6 py-4 text-primary-foreground shadow-[0_14px_34px_-16px] shadow-primary/60">
          <div className="text-center">
            <p className="flex items-center justify-center gap-1 font-display text-3xl font-semibold tabular-nums">
              <Flame className="size-6" />
              {stats.currentStreak}
            </p>
            <p className="text-xs uppercase tracking-wide text-primary-foreground/75">
              Day streak
            </p>
          </div>
          <div className="h-10 w-px bg-primary-foreground/25" />
          <div className="text-center">
            <p className="flex items-center justify-center gap-1 font-display text-3xl font-semibold tabular-nums">
              <Trophy className="size-5" />
              {stats.longestStreak}
            </p>
            <p className="text-xs uppercase tracking-wide text-primary-foreground/75">
              Best
            </p>
          </div>
        </div>
      </div>
      </StaggerItem>

      <StaggerItem>
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map(({ icon, label, value }) => (
          <StatCard key={label} icon={icon} label={label} value={value} />
        ))}
      </div>
      </StaggerItem>

      <StaggerItem>
      {/* Details + specializations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-subtle rounded-2xl p-6">
          <h3 className="mb-4 font-display text-lg font-semibold tracking-tight">
            Practice details
          </h3>
          <dl className="space-y-3">
            {details.map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0"
              >
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-right text-sm font-medium">
                  {value || <span className="text-muted-foreground/60">—</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="glass-subtle rounded-2xl p-6">
          <h3 className="mb-4 font-display text-lg font-semibold tracking-tight">
            Specializations
          </h3>
          {profile.specializations.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.specializations.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm text-primary"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              None added yet — you can update these any time.
            </p>
          )}
        </div>
      </div>

      </StaggerItem>

      <StaggerItem>
        {/* Background reminders opt-in */}
        <PushToggle userId={user.id} />
      </StaggerItem>

      <StaggerItem>
        {/* Achievements */}
        <AchievementsGrid earned={earned} />
      </StaggerItem>
      </Stagger>
    </div>
  );
}
