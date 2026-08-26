"use client";

/**
 * Workspace navigation with an animated active indicator: the highlight pill
 * glides between tabs via framer-motion's shared layoutId.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BrainCircuit,
  CalendarClock,
  Inbox,
  LayoutDashboard,
  Mic,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string; icon: LucideIcon; match: string[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: ["/dashboard"] },
  { href: "/patients", label: "Patients", icon: UsersRound, match: ["/patients"] },
  { href: "/schedule", label: "Schedule", icon: CalendarClock, match: ["/schedule"] },
  { href: "/memory", label: "Memory", icon: BrainCircuit, match: ["/memory"] },
  { href: "/sessions/new", label: "New session", icon: Mic, match: ["/sessions/new"] },
  { href: "/profile", label: "Profile", icon: UserRound, match: ["/profile"] },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex w-max items-center gap-1">
      {LINKS.map(({ href, label, icon: Icon, match }) => {
        const active = match.some((m) => pathname.startsWith(m));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-secondary text-foreground font-semibold border border-border"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
