"use client";

/**
 * Compact appointment list for a single patient's profile: upcoming first,
 * then recent past. The "Schedule" button and each row open the shared
 * AppointmentSheet, pre-scoped to this patient.
 */

import { useState } from "react";
import { CalendarPlus, Clock, MapPin } from "lucide-react";

import type { Appointment } from "@/lib/types";
import { Badge, APPOINTMENT_STATUS_TONE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppointmentSheet } from "@/components/schedule/AppointmentSheet";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function PatientAppointments({
  patientId,
  patientName,
  appointments,
}: {
  patientId: string;
  patientName: string;
  appointments: Appointment[];
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

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
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Appointments
        </h2>
        <Button size="sm" onClick={openCreate}>
          <CalendarPlus />
          Schedule
        </Button>
      </div>

      {appointments.length === 0 ? (
        <button
          type="button"
          onClick={openCreate}
          className="flex w-full flex-col items-center rounded-md border border-dashed border-border bg-card px-6 py-6 text-center transition-colors hover:border-foreground/25"
        >
          <div className="mb-2.5 flex size-9 items-center justify-center rounded-md bg-muted text-foreground">
            <CalendarPlus className="size-4" />
          </div>
          <p className="text-xs font-bold text-foreground">No appointments yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Book {patientName.split(" ")[0]}&rsquo;s next session.
          </p>
        </button>
      ) : (
        <ul className="space-y-2">
          {appointments.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => openEdit(a)}
                className="flex w-full items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-foreground/20"
              >
                <div className="flex min-w-[4rem] flex-col items-center rounded-sm bg-muted px-2.5 py-1.5 text-foreground font-mono">
                  <span className="text-xs font-medium">
                    {dateFmt.format(new Date(a.starts_at))}
                  </span>
                  <span className="flex items-center gap-1 text-[0.7rem] text-primary/70">
                    <Clock className="size-3" />
                    {timeFmt.format(new Date(a.starts_at))}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.title}</p>
                  {a.location && (
                    <span className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" />
                      {a.location}
                    </span>
                  )}
                </div>
                <Badge tone={APPOINTMENT_STATUS_TONE[a.status]}>
                  {a.status}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AppointmentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        appointment={editing}
        patients={[{ id: patientId, full_name: patientName }]}
        defaultPatientId={patientId}
      />
    </div>
  );
}
