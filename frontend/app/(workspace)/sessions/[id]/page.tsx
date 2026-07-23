/** Session detail: pipeline status → note review → transcript + summary. */

import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ProcessingPoller } from "@/components/notes/ProcessingPoller";
import { SessionDocPreview } from "@/components/notes/SessionDocPreview";
import { NoteView } from "@/components/notes/NoteView";
import { TranscriptPanel } from "@/components/notes/TranscriptPanel";
import { isNonEnglishTranscript } from "@/lib/note";
import {
  Badge,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_TONE,
} from "@/components/ui/badge";
import type { ClinicalSession, Patient } from "@/lib/types";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS makes this owner-scoped: another clinician's id simply returns null.
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle<ClinicalSession>();

  if (!session) notFound();

  let patient: Pick<Patient, "id" | "full_name"> | null = null;
  if (session.patient_id) {
    const { data } = await supabase
      .from("patients")
      .select("id, full_name")
      .eq("id", session.patient_id)
      .maybeSingle<Pick<Patient, "id" | "full_name">>();
    patient = data;
  }

  const reviewable = session.status === "ready" || session.status === "exported";
  // Prefer the pipeline's flag (detected on the original script, before
  // romanization); fall back to text-detection for rows predating migration 0020.
  const nonEnglish =
    session.source_non_english ??
    (session.raw_transcript ? isNonEnglishTranscript(session.raw_transcript) : false);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {session.title}
            </h1>
            <Badge tone={SESSION_STATUS_TONE[session.status]}>
              {SESSION_STATUS_LABEL[session.status]}
            </Badge>
          </div>
          {patient && (
            <p className="mt-1 text-sm text-muted-foreground">
              Patient:{" "}
              <Link
                href={`/patients/${patient.id}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {patient.full_name}
              </Link>
            </p>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {new Date(session.created_at).toLocaleString()}
        </span>
      </div>

      <div className="mt-8 space-y-8">
        {session.status === "processing" && (
          <ProcessingPoller sessionId={session.id} title={session.title} />
        )}

        {session.status === "failed" && (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
            {session.error_detail ?? "Processing failed."}
          </p>
        )}

        {reviewable && session.note && (
          <NoteView
            sessionId={session.id}
            note={session.note}
            exported={session.status === "exported"}
            reviewedAt={session.reviewed_at}
            noteEditedAt={session.note_edited_at}
            nonEnglish={nonEnglish}
          />
        )}

        {reviewable && session.raw_transcript && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Transcript &amp; summary
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <SessionDocPreview
                  kind="Transcript"
                  sessionTitle={session.title}
                  patientName={patient?.full_name ?? null}
                  dateISO={session.created_at}
                  transcript={session.raw_transcript}
                />
                {session.note && (
                  <SessionDocPreview
                    kind="Summary"
                    sessionTitle={session.title}
                    patientName={patient?.full_name ?? null}
                    dateISO={session.created_at}
                    note={session.note}
                  />
                )}
              </div>
            </div>
            <TranscriptPanel
              sessionId={session.id}
              title={session.title}
              transcript={session.raw_transcript}
              initialSummary={session.summary}
              patientName={patient?.full_name ?? null}
              dateISO={session.created_at}
            />
          </div>
        )}
      </div>
    </div>
  );
}
