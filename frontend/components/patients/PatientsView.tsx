"use client";

/**
 * The roster, organised by care status. The default view groups patients into
 * Active / Paused / Discharged sections (each a labelled band of cards), so the
 * roster reads as stages of care rather than an undifferentiated list. A
 * compact table remains available as a secondary toggle.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CircleDot,
  Columns3,
  PauseCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Table2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { Patient, PatientStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, PATIENT_STATUS_TONE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EASE_OUT } from "@/components/motion/primitives";
import { PatientSheet } from "@/components/patients/PatientSheet";

type ViewMode = "groups" | "table";

const STATUS_META: {
  status: PatientStatus;
  label: string;
  icon: LucideIcon;
  accent: string;
  dot: string;
}[] = [
  { status: "active", label: "Active", icon: CircleDot, accent: "text-primary", dot: "bg-primary" },
  { status: "paused", label: "Paused", icon: PauseCircle, accent: "text-amber-600", dot: "bg-amber-500" },
  { status: "discharged", label: "Discharged", icon: ShieldCheck, accent: "text-muted-foreground", dot: "bg-muted-foreground" },
];

function age(dob: string | null): string {
  if (!dob) return "—";
  const born = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) years -= 1;
  return years >= 0 ? String(years) : "—";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function PatientsView({ patients }: { patients: Patient[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("groups");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        (p.presenting_concerns ?? "").toLowerCase().includes(q),
    );
  }, [patients, query]);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(patient: Patient) {
    setEditing(patient);
    setSheetOpen(true);
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients…"
            className="pl-10"
            aria-label="Search patients"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="glass-subtle flex items-center gap-0.5 rounded-xl p-1">
            {(
              [
                ["groups", Columns3, "Grouped by status"],
                ["table", Table2, "Table view"],
              ] as const
            ).map(([mode, Icon, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-label={label}
                aria-pressed={view === mode}
                className={cn(
                  "relative cursor-pointer rounded-lg px-3 py-1.5 transition-colors",
                  view === mode
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {view === mode && (
                  <motion.span
                    layoutId="view-toggle"
                    className="absolute inset-0 rounded-lg bg-foreground/8"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <Icon className="relative size-4" />
              </button>
            ))}
          </div>
          <Button onClick={openCreate}>
            <Plus />
            Add patient
          </Button>
        </div>
      </div>

      {/* Content */}
      {patients.length === 0 ? (
        <div className="glass mt-10 flex flex-col items-center rounded-3xl px-8 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <UsersRound className="size-7" />
          </div>
          <h2 className="mt-5 font-display text-lg font-semibold">
            Your roster is empty
          </h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Add your first patient to start attaching sessions and building
            their private memory.
          </p>
          <Button onClick={openCreate} className="mt-6">
            <Plus />
            Add your first patient
          </Button>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {view === "groups" ? (
            <motion.div
              key="groups"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="mt-8 space-y-8"
            >
              {STATUS_META.map(({ status, label, icon: Icon, accent, dot }) => {
                const cards = filtered.filter((p) => p.status === status);
                if (cards.length === 0) return null;
                return (
                  <section key={status}>
                    <div className="mb-3 flex items-center gap-2.5">
                      <span className={`flex size-7 items-center justify-center rounded-lg bg-foreground/5 ${accent}`}>
                        <Icon className="size-4" />
                      </span>
                      <h3 className="font-display text-lg font-semibold tracking-tight">
                        {label}
                      </h3>
                      <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {cards.length}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {cards.map((p, i) => (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, ease: EASE_OUT, delay: Math.min(i * 0.04, 0.4) }}
                          onClick={() => router.push(`/patients/${p.id}`)}
                          className="glass card-lift group relative cursor-pointer rounded-2xl p-4"
                        >
                          <div className="flex items-start gap-3">
                            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground/6 text-sm font-semibold ${accent}`}>
                              {initials(p.full_name) || "?"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium transition-colors group-hover:text-primary">
                                {p.full_name}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {p.pronouns ? `${p.pronouns} · ` : ""}
                                {age(p.date_of_birth) !== "—" ? `${age(p.date_of_birth)} yrs` : "Age —"}
                              </p>
                            </div>
                            <span className={`size-2 rounded-full ${dot}`} />
                          </div>
                          {p.presenting_concerns && (
                            <p className="mt-3 line-clamp-2 border-t border-border/60 pt-2.5 text-xs leading-relaxed text-muted-foreground">
                              {p.presenting_concerns}
                            </p>
                          )}
                          <button
                            type="button"
                            aria-label={`Edit ${p.full_name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(p);
                            }}
                            className="absolute right-2 top-2 cursor-pointer rounded-lg p-2 text-muted-foreground opacity-0 transition-all hover:bg-foreground/8 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </section>
                );
              })}
              {filtered.length === 0 && (
                <p className="glass-subtle rounded-2xl px-5 py-10 text-center text-sm text-muted-foreground">
                  No patients match “{query}”.
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="table"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="glass mt-6 overflow-hidden rounded-2xl"
            >
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-foreground/8 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3.5 font-medium">Name</th>
                    <th className="hidden px-5 py-3.5 font-medium sm:table-cell">Age</th>
                    <th className="hidden px-5 py-3.5 font-medium md:table-cell">
                      Presenting concerns
                    </th>
                    <th className="px-5 py-3.5 font-medium">Status</th>
                    <th className="px-2 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/patients/${p.id}`)}
                      className="group cursor-pointer border-b border-foreground/5 transition-colors last:border-b-0 hover:bg-foreground/5"
                    >
                      <td className="px-5 py-4">
                        <span className="font-medium transition-colors group-hover:text-primary">
                          {p.full_name}
                        </span>
                        {p.pronouns && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {p.pronouns}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-5 py-4 text-muted-foreground sm:table-cell">
                        {age(p.date_of_birth)}
                      </td>
                      <td className="hidden max-w-64 truncate px-5 py-4 text-muted-foreground md:table-cell">
                        {p.presenting_concerns ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={PATIENT_STATUS_TONE[p.status]}>{p.status}</Badge>
                      </td>
                      <td className="px-2 py-4">
                        <button
                          type="button"
                          aria-label={`Edit ${p.full_name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(p);
                          }}
                          className="cursor-pointer rounded-lg p-2 text-muted-foreground opacity-0 transition-all hover:bg-foreground/8 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No patients match “{query}”.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <PatientSheet open={sheetOpen} onOpenChange={setSheetOpen} patient={editing} />
    </div>
  );
}
