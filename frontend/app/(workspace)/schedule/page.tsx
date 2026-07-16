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
        <div className="glass-subtle mt-8 flex items-start gap-3 rounded-2xl p-5 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" />
          <p>
            Add people to your{" "}
            <span className="text-foreground">Patients</span> roster to link
            appointments to them. You can still schedule unattributed slots in
            the meantime.
          </p>
        </div>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="glass-subtle rounded-2xl p-6">
          <CalendarClock className="mb-3 size-5 text-primary" />
          <p className="font-medium">Times follow your device</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Appointments are stored as absolute moments and shown in your
            browser&rsquo;s current time zone, so they stay correct as you
            travel.
          </p>
        </div>
        <div className="glass-subtle rounded-2xl p-6">
          <Info className="mb-3 size-5 text-accent" />
          <p className="font-medium">Only you can see this</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Your calendar is isolated to your account. No colleague, and no
            other clinician on Aura, can read or infer your schedule.
          </p>
        </div>
      </div>
    </div>
  );
}
