"use client";

/**
 * Agenda for the whole practice: appointments split into Upcoming / Past, then
 * grouped by day. Rows open the edit sheet; the header button opens it in
 * create mode. Data arrives pre-fetched under RLS from the server component.
 */

import { useMemo, useState } from "react";
import { CalendarPlus, Clock, MapPin, UserRound } from "lucide-react";

import type { Appointment } from "@/lib/types";
import { Badge, APPOINTMENT_STATUS_TONE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AppointmentSheet,
  type RosterOption,
} from "@/components/schedule/AppointmentSheet";

/** Appointment row with the embedded patient name from the PostgREST join. */
export type AppointmentRow = Appointment & {
  patients: { full_name: string } | null;
};

const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

/** Impure clock read kept out of the render body (react-hooks/purity). */
function nowMs(): number {
  return Date.now();
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function relativeDayLabel(iso: string): string | null {
  const now = new Date();
  const then = new Date(iso);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(then) - startOfDay(now)) / 86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return null;
}

interface DayGroup {
  key: string;
  iso: string;
  items: AppointmentRow[];
}

function groupByDay(items: AppointmentRow[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const item of items) {
    const key = dayKey(item.starts_at);
    const existing = groups.get(key);
    if (existing) existing.items.push(item);
    else groups.set(key, { key, iso: item.starts_at, items: [item] });
  }
  return [...groups.values()];
}

export function ScheduleView({
  appointments,
  patients,
}: {
  appointments: AppointmentRow[];
  patients: RosterOption[];
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const { upcoming, past } = useMemo(() => {
    const now = nowMs();
    const up: AppointmentRow[] = [];
    const pa: AppointmentRow[] = [];
    for (const a of appointments) {
      (new Date(a.ends_at).getTime() >= now ? up : pa).push(a);
    }
    up.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    pa.sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    return {
      upcoming: groupByDay(up),
      past: groupByDay(pa),
    };
  }, [appointments]);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(a: Appointment) {
    setEditing(a);
    setSheetOpen(true);
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <Button onClick={openCreate}>
          <CalendarPlus />
          New appointment
        </Button>
      </div>

      {appointments.length === 0 ? (
        <div className="glass-subtle flex flex-col items-center rounded-2xl px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <CalendarPlus className="size-6" />
          </div>
          <p className="font-display text-lg font-semibold">
            No appointments yet
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Schedule your first session and it&rsquo;ll appear here, grouped by
            day. Everything stays private to your account.
          </p>
          <Button className="mt-6" onClick={openCreate}>
            <CalendarPlus />
            New appointment
          </Button>
        </div>
      ) : (
        <div className="space-y-10">
          <Section title="Upcoming" groups={upcoming} onEdit={openEdit} />
          <Section title="Past" groups={past} onEdit={openEdit} muted />
        </div>
      )}

      <AppointmentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        appointment={editing}
        patients={patients}
      />
    </div>
  );
}

function Section({
  title,
  groups,
  onEdit,
  muted,
}: {
  title: string;
  groups: DayGroup[];
  onEdit: (a: Appointment) => void;
  muted?: boolean;
}) {
  if (groups.length === 0) return null;
  return (
    <section>
      <h2 className="mb-4 font-display text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {relativeDayLabel(g.iso) ?? dayFmt.format(new Date(g.iso))}
            </p>
            <div className="space-y-2">
              {g.items.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appt={a}
                  onEdit={onEdit}
                  muted={muted}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AppointmentCard({
  appt,
  onEdit,
  muted,
}: {
  appt: AppointmentRow;
  onEdit: (a: Appointment) => void;
  muted?: boolean;
}) {
  const name = appt.patients?.full_name;
  return (
    <button
      type="button"
      onClick={() => onEdit(appt)}
      className={`glass group flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all duration-200 hover:border-foreground/20 ${
        muted ? "opacity-75 hover:opacity-100" : ""
      }`}
    >
      <div className="flex min-w-[5.5rem] flex-col items-center rounded-xl bg-primary/10 px-3 py-2 text-primary">
        <span className="text-sm font-semibold tabular-nums">
          {timeFmt.format(new Date(appt.starts_at))}
        </span>
        <span className="flex items-center gap-1 text-[0.7rem] text-primary/70">
          <Clock className="size-3" />
          {timeFmt.format(new Date(appt.ends_at))}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{appt.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {name && (
            <span className="flex items-center gap-1.5">
              <UserRound className="size-3.5" />
              {name}
            </span>
          )}
          {appt.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {appt.location}
            </span>
          )}
        </div>
      </div>

      <Badge tone={APPOINTMENT_STATUS_TONE[appt.status]}>{appt.status}</Badge>
    </button>
  );
}
