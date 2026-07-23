/**
 * Authenticated shell: aurora backdrop + sticky glass nav. Clinicians who
 * haven't completed intake are routed to /onboarding first.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { computeEarnedBadges } from "@/lib/badges";
import { gatherStats } from "@/lib/stats";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { AuraWordmark } from "@/components/ui/aura-logo";
import { Butterfly } from "@/components/ui/butterfly";
import { CursorTrail } from "@/components/ui/cursor-trail";
import { FloatingQuotes } from "@/components/ui/floating-quotes";
import { NavLinks } from "@/components/ui/nav-links";
import { isOwnerEmail } from "@/lib/owner";
import { isCheckinEmail } from "@/lib/checkin-user";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AchievementToaster } from "@/components/profile/AchievementToaster";
import { ActivityPing } from "@/components/profile/ActivityPing";
import { SessionWatcher } from "@/components/notes/SessionWatcher";
import { AppointmentReminder } from "@/components/schedule/AppointmentReminder";
import { MaintenanceBanner } from "@/components/system/MaintenanceBanner";
import { InstallNudge } from "@/components/pwa/InstallNudge";
import { DailyCheckin } from "@/components/checkin/DailyCheckin";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Intake gate. On a pre-0003/0010 schema this select errors and profile is
  // null — we let the user through rather than brick the workspace.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .maybeSingle<Profile>();

  if (profile && !profile.onboarded) redirect("/onboarding");

  // Achievements: recompute earned badges from live activity and surface any
  // that just crossed their threshold. Cheap count queries under RLS.
  let newlyEarned: string[] = [];
  let allEarned: string[] = [];
  if (profile?.onboarded) {
    const stats = await gatherStats(profile);
    allEarned = computeEarnedBadges(stats);
    const persisted = new Set(profile.earned_badges ?? []);
    newlyEarned = allEarned.filter((id) => !persisted.has(id));
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <AuroraBackground />
      <CursorTrail />
      <Butterfly />
      <FloatingQuotes />

      {profile?.onboarded && (
        <>
          <ActivityPing />
          <SessionWatcher />
          <AppointmentReminder />
          <AchievementToaster
            userId={user.id}
            newlyEarned={newlyEarned}
            allEarned={allEarned}
          />
          {/* One-time install suggestion for a just-registered clinician. */}
          <InstallNudge />
          {/* Daily well-being check-in — a no-op for all but one account. */}
          <DailyCheckin userEmail={user.email ?? null} />
        </>
      )}

      <header className="sticky top-0 z-40 px-2 pt-2 sm:px-4 sm:pt-3">
        <nav className="aura-navbar mx-auto flex w-full max-w-6xl items-center gap-2 rounded-2xl px-3 py-2.5 backdrop-blur-xl sm:gap-4 sm:px-5 sm:py-3">
          <Link
            href="/"
            className="shrink-0 transition-opacity hover:opacity-80"
            aria-label="Aura home"
          >
            <AuraWordmark />
          </Link>
          {/* Scrollable on small screens so the pill never pushes off-screen */}
          <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <NavLinks
              showInbox={isOwnerEmail(user.email) || isCheckinEmail(user.email)}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4 sm:pl-2">
            <span className="hidden text-[0.95rem] text-muted-foreground lg:inline">
              {user.email}
            </span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </nav>
      </header>

      {/* Sits under the nav so it is the first thing read when the backend is
          down, without hiding records that are still perfectly usable. */}
      <MaintenanceBanner />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}
