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
              "relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 font-display text-[0.95rem] font-medium tracking-tight transition-colors duration-200 sm:px-4",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-full border border-foreground/10 bg-foreground/6"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <Icon className="relative size-4" />
            <span className="relative hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
