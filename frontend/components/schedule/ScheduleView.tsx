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
        <div className="flex flex-col items-center rounded-md border border-border bg-card px-6 py-16 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <CalendarPlus className="size-6" />
          </div>
          <p className="text-base font-bold text-foreground">
            No appointments scheduled
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Schedule your first session to keep track of your calendar.
          </p>
          <Button className="mt-5" onClick={openCreate} size="sm">
            <CalendarPlus className="size-4" />
            New appointment
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
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
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground border-b border-border pb-2">
        {title}
      </h2>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="mb-2 text-[11px] font-mono uppercase text-muted-foreground">
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
      className={`group flex w-full items-center gap-4 rounded-md border border-border bg-card p-3.5 text-left transition-colors hover:border-foreground/30 ${
        muted ? "opacity-75 hover:opacity-100" : ""
      }`}
    >
      <div className="flex min-w-[5rem] flex-col items-center rounded-md border border-border bg-muted px-2.5 py-1.5 text-foreground">
        <span className="text-xs font-bold tabular-nums font-mono">
          {timeFmt.format(new Date(appt.starts_at))}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
          <Clock className="size-3" />
          {timeFmt.format(new Date(appt.ends_at))}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-foreground sm:text-sm">{appt.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {name && (
            <span className="flex items-center gap-1">
              <UserRound className="size-3" />
              {name}
            </span>
          )}
          {appt.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {appt.location}
            </span>
          )}
        </div>
      </div>

      <Badge tone={APPOINTMENT_STATUS_TONE[appt.status]}>{appt.status}</Badge>
    </button>
  );
}
