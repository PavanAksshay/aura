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
          className="glass-subtle flex w-full flex-col items-center rounded-2xl border-dashed px-6 py-8 text-center transition-colors hover:border-foreground/25"
        >
          <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <CalendarPlus className="size-5" />
          </div>
          <p className="font-medium">No appointments yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
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
                className="glass flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all duration-200 hover:border-foreground/20"
              >
                <div className="flex min-w-[4.5rem] flex-col items-center rounded-xl bg-primary/10 px-3 py-2 text-primary">
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
