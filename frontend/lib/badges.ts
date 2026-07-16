/**
 * Achievement catalogue — 25 badges earned from real workspace activity.
 * Each badge's `earned` predicate runs against a Stats snapshot gathered from
 * the clinician's own data (streak, sessions, patients, …). Ids are stable and
 * persisted in profiles.earned_badges so an "unlocked" toast fires once.
 */

import {
  Award,
  BriefcaseMedical,
  CalendarCheck,
  CalendarClock,
  CalendarHeart,
  FileCheck2,
  FileStack,
  Flame,
  FolderOpen,
  Gem,
  Medal,
  Mic,
  Moon,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserPlus,
  Users,
  UsersRound,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

export interface Stats {
  currentStreak: number;
  longestStreak: number;
  sessions: number;
  exported: number;
  patients: number;
  appointments: number;
  documents: number;
  specializations: number;
  onboarded: boolean;
  hasAvatar: boolean;
  nightOwl: boolean;
}

export type BadgeTier = "bronze" | "silver" | "gold" | "special";

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  tier: BadgeTier;
  earned: (s: Stats) => boolean;
}

export const BADGES: Badge[] = [
  // — Getting started —
  {
    id: "welcome",
    name: "Welcome to Aura",
    description: "Complete your onboarding.",
    icon: Sparkles,
    tier: "special",
    earned: (s) => s.onboarded,
  },
  {
    id: "identity",
    name: "Face to the Name",
    description: "Pick a profile avatar.",
    icon: Star,
    tier: "bronze",
    earned: (s) => s.hasAvatar,
  },
  {
    id: "specialist",
    name: "Specialist",
    description: "Add three or more specializations.",
    icon: Target,
    tier: "bronze",
    earned: (s) => s.specializations >= 3,
  },
  // — Login streaks —
  {
    id: "streak-3",
    name: "Warming Up",
    description: "Reach a 3-day login streak.",
    icon: Flame,
    tier: "bronze",
    earned: (s) => s.currentStreak >= 3 || s.longestStreak >= 3,
  },
  {
    id: "streak-7",
    name: "Consistent",
    description: "Reach a 7-day login streak.",
    icon: Flame,
    tier: "silver",
    earned: (s) => s.currentStreak >= 7 || s.longestStreak >= 7,
  },
  {
    id: "streak-14",
    name: "Dedicated",
    description: "Reach a 14-day login streak.",
    icon: Flame,
    tier: "gold",
    earned: (s) => s.currentStreak >= 14 || s.longestStreak >= 14,
  },
  {
    id: "streak-30",
    name: "Unstoppable",
    description: "Reach a 30-day login streak.",
    icon: Trophy,
    tier: "gold",
    earned: (s) => s.currentStreak >= 30 || s.longestStreak >= 30,
  },
  {
    id: "streak-100",
    name: "Centurion",
    description: "Reach a 100-day login streak.",
    icon: Gem,
    tier: "special",
    earned: (s) => s.longestStreak >= 100 || s.currentStreak >= 100,
  },
  // — Sessions —
  {
    id: "session-1",
    name: "First Words",
    description: "Record your first session.",
    icon: Mic,
    tier: "bronze",
    earned: (s) => s.sessions >= 1,
  },
  {
    id: "session-10",
    name: "In the Flow",
    description: "Record 10 sessions.",
    icon: Mic,
    tier: "silver",
    earned: (s) => s.sessions >= 10,
  },
  {
    id: "session-50",
    name: "Seasoned Scribe",
    description: "Record 50 sessions.",
    icon: Waypoints,
    tier: "gold",
    earned: (s) => s.sessions >= 50,
  },
  {
    id: "session-100",
    name: "Century of Care",
    description: "Record 100 sessions.",
    icon: Award,
    tier: "gold",
    earned: (s) => s.sessions >= 100,
  },
  {
    id: "session-250",
    name: "Living Archive",
    description: "Record 250 sessions.",
    icon: Gem,
    tier: "special",
    earned: (s) => s.sessions >= 250,
  },
  // — Exported notes —
  {
    id: "export-1",
    name: "Note Taker",
    description: "Export your first clinical note.",
    icon: FileCheck2,
    tier: "bronze",
    earned: (s) => s.exported >= 1,
  },
  {
    id: "export-25",
    name: "Documentarian",
    description: "Export 25 notes.",
    icon: FileStack,
    tier: "silver",
    earned: (s) => s.exported >= 25,
  },
  {
    id: "export-100",
    name: "Master of Record",
    description: "Export 100 notes.",
    icon: Medal,
    tier: "gold",
    earned: (s) => s.exported >= 100,
  },
  // — Patients —
  {
    id: "patient-1",
    name: "First Client",
    description: "Add your first patient.",
    icon: UserPlus,
    tier: "bronze",
    earned: (s) => s.patients >= 1,
  },
  {
    id: "patient-5",
    name: "Building a Practice",
    description: "Add 5 patients.",
    icon: Users,
    tier: "silver",
    earned: (s) => s.patients >= 5,
  },
  {
    id: "patient-25",
    name: "Full Roster",
    description: "Add 25 patients.",
    icon: UsersRound,
    tier: "gold",
    earned: (s) => s.patients >= 25,
  },
  {
    id: "patient-50",
    name: "Community Pillar",
    description: "Add 50 patients.",
    icon: BriefcaseMedical,
    tier: "special",
    earned: (s) => s.patients >= 50,
  },
  // — Scheduling —
  {
    id: "appt-1",
    name: "On the Calendar",
    description: "Schedule your first appointment.",
    icon: CalendarCheck,
    tier: "bronze",
    earned: (s) => s.appointments >= 1,
  },
  {
    id: "appt-25",
    name: "Well Booked",
    description: "Schedule 25 appointments.",
    icon: CalendarClock,
    tier: "silver",
    earned: (s) => s.appointments >= 25,
  },
  {
    id: "appt-100",
    name: "Time Keeper",
    description: "Schedule 100 appointments.",
    icon: CalendarHeart,
    tier: "gold",
    earned: (s) => s.appointments >= 100,
  },
  // — Documents & habits —
  {
    id: "doc-1",
    name: "Paper Trail",
    description: "Upload your first document.",
    icon: FolderOpen,
    tier: "bronze",
    earned: (s) => s.documents >= 1,
  },
  {
    id: "night-owl",
    name: "Night Owl",
    description: "Record a session late at night.",
    icon: Moon,
    tier: "special",
    earned: (s) => s.nightOwl,
  },
];

export function computeEarnedBadges(stats: Stats): string[] {
  return BADGES.filter((b) => b.earned(stats)).map((b) => b.id);
}
