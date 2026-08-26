/** Practice schedule — appointments fetched server-side under RLS. */

import { CalendarClock, Info } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { Patient } from "@/lib/types";
import type { AppointmentRow } from "@/components/schedule/ScheduleView";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import type { RosterOption } from "@/components/schedule/AppointmentSheet";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const supabase = await createClient();

  // Both queries run under RLS. The appointments select embeds the patient
  // name via the patient_id foreign key (PostgREST join).
  const [{ data: appointments, error }, { data: patients }] = await Promise.all(
    [
      supabase
        .from("appointments")
        .select("*, patients(full_name)")
        .order("starts_at", { ascending: true })
        .returns<AppointmentRow[]>(),
      supabase
        .from("patients")
        .select("id, full_name")
        .order("full_name", { ascending: true })
        .returns<Pick<Patient, "id" | "full_name">[]>(),
    ],
  );

  if (error) {
    return (
      <p className="text-destructive">
        Could not load appointments: {error.message}. If you just upgraded, make
        sure migration 0008 has been applied.
      </p>
    );
  }

  const roster: RosterOption[] = patients ?? [];

  return (
    <div>
      <PageHeading
        title="Your"
        accent="schedule"
        subtitle="Upcoming and past appointments — private to your account by row-level security."
      />

      <ScheduleView appointments={appointments} patients={roster} />

      {roster.length === 0 && (
        <div className="mt-6 flex items-start gap-2.5 rounded-md border border-border bg-card p-4 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-foreground" />
          <p>
            Add people to your{" "}
            <span className="font-semibold text-foreground">Patients</span> roster to link
            appointments to them. You can still schedule unattributed slots in
            the meantime.
          </p>
        </div>
      )}
    </div>
  );
}
