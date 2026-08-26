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
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-1">
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
                  "relative cursor-pointer rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  view === mode
                    ? "bg-card text-foreground font-semibold border border-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="size-4" />
            Add patient
          </Button>
        </div>
      </div>

      {/* Content */}
      {patients.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-md border border-border bg-card px-8 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <UsersRound className="size-6" />
          </div>
          <h2 className="mt-4 text-base font-bold text-foreground">
            Your roster is empty
          </h2>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Add your first patient to attach clinical sessions and build their record.
          </p>
          <Button onClick={openCreate} className="mt-5" size="sm">
            <Plus className="size-4" />
            Add your first patient
          </Button>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {view === "groups" ? (
            <motion.div
              key="groups"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-6 space-y-6"
            >
              {STATUS_META.map(({ status, label, icon: Icon, accent, dot }) => {
                const cards = filtered.filter((p) => p.status === status);
                if (cards.length === 0) return null;
                return (
                  <section key={status}>
                    <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                      <Icon className={cn("size-4", accent)} />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        {label}
                      </h3>
                      <span className="rounded-sm border border-border bg-muted px-1.5 py-0.2 text-[11px] font-mono text-muted-foreground">
                        {cards.length}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {cards.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => router.push(`/patients/${p.id}`)}
                          className="group relative cursor-pointer rounded-md border border-border bg-card p-4 transition-colors hover:border-foreground/40"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-bold text-foreground">
                              {initials(p.full_name) || "?"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold text-foreground group-hover:text-primary sm:text-sm">
                                {p.full_name}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">
                                {p.pronouns ? `${p.pronouns} · ` : ""}
                                {age(p.date_of_birth) !== "—" ? `${age(p.date_of_birth)} yrs` : "Age —"}
                              </p>
                            </div>
                            <span className={`size-2 rounded-full ${dot}`} />
                          </div>
                          {p.presenting_concerns && (
                            <p className="mt-3 line-clamp-2 border-t border-border pt-2 text-xs text-muted-foreground">
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
                            className="absolute right-2 top-2 cursor-pointer rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
              {filtered.length === 0 && (
                <p className="rounded-md border border-border bg-muted/30 px-5 py-8 text-center text-xs text-muted-foreground">
                  No patients match “{query}”.
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-6 overflow-hidden rounded-md border border-border bg-card"
            >
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="hidden px-4 py-3 font-semibold sm:table-cell">Age</th>
                    <th className="hidden px-4 py-3 font-semibold md:table-cell">
                      Presenting concerns
                    </th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/patients/${p.id}`)}
                      className="group cursor-pointer transition-colors hover:bg-muted/50"
                    >
                      <td className="px-4 py-3">
                        <span className="font-semibold text-foreground group-hover:text-primary">
                          {p.full_name}
                        </span>
                        {p.pronouns && (
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            ({p.pronouns})
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-muted-foreground sm:table-cell">
                        {age(p.date_of_birth)}
                      </td>
                      <td className="hidden max-w-64 truncate px-4 py-3 text-muted-foreground md:table-cell">
                        {p.presenting_concerns ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={PATIENT_STATUS_TONE[p.status]}>{p.status}</Badge>
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          aria-label={`Edit ${p.full_name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(p);
                          }}
                          className="cursor-pointer rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="px-5 py-8 text-center text-xs text-muted-foreground">
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
