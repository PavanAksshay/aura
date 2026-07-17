/** Patient profile: identity card, appointments, documents, session timeline. */

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type {
  Appointment,
  ClinicalSession,
  Patient,
  PatientDocument,
} from "@/lib/types";
import { PatientAppointments } from "@/components/patients/PatientAppointments";
import { PatientDocuments } from "@/components/patients/PatientDocuments";
import { PatientHeader } from "@/components/patients/PatientHeader";
import { SessionTimeline } from "@/components/patients/SessionTimeline";

type TimelineRow = Pick<
  ClinicalSession,
  | "id"
  | "title"
  | "status"
  | "created_at"
  | "audio_duration_seconds"
  | "summary"
  | "note"
  | "raw_transcript"
  | "clinician_notes"
>;

/** Impure time helper kept out of the render body (react-hooks/purity). */
function sixtyDaysAgoIso(): string {
  return new Date(Date.now() - 60 * 86_400_000).toISOString();
}

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // All queries run under RLS — another clinician's patient id 404s. Past
  // appointments are trimmed to the last 60 days; upcoming are unbounded.
  const sixtyDaysAgo = sixtyDaysAgoIso();
  const [
    { data: patient },
    { data: sessions },
    { data: appointments },
    { data: documents },
  ] = await Promise.all([
    supabase.from("patients").select("*").eq("id", id).maybeSingle<Patient>(),
    supabase
      .from("sessions")
      .select(
        "id, title, status, created_at, audio_duration_seconds, summary, note, raw_transcript, clinician_notes",
      )
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .returns<TimelineRow[]>(),
    supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", id)
      .gte("starts_at", sixtyDaysAgo)
      .order("starts_at", { ascending: true })
      .returns<Appointment[]>(),
    supabase
      .from("documents")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .returns<PatientDocument[]>(),
  ]);

  if (!patient) notFound();

  return (
    <div>
      <PatientHeader patient={patient} />

      {user && (
        <div className="mt-10 space-y-10">
          <PatientAppointments
            patientId={patient.id}
            patientName={patient.full_name}
            appointments={appointments ?? []}
          />
          <PatientDocuments
            patientId={patient.id}
            userId={user.id}
            documents={documents ?? []}
          />
        </div>
      )}

      <div className="mt-10">
        <h2 className="mb-5 font-display text-lg font-semibold tracking-tight">
          Session history
        </h2>
        <SessionTimeline
          sessions={sessions ?? []}
          patientId={patient.id}
          patientName={patient.full_name}
        />
      </div>
    </div>
  );
}
