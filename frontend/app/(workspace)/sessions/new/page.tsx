/** Session capture. Patients are fetched under RLS for the optional link. */

import { Mic, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { AudioRecorder, type PatientOption } from "@/components/audio/AudioRecorder";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata = { title: "New session" };

const STEPS = [
  {
    icon: Mic,
    title: "Record",
    body: "Capture the session audio. A live waveform confirms Aura is listening.",
  },
  {
    icon: Sparkles,
    title: "Transcribe & structure",
    body: "Whisper large-v3 transcribes on your machine, then drafts a SOAP note. A short session takes under a minute; longer ones a few minutes.",
  },
  {
    icon: ShieldCheck,
    title: "Review & export",
    body: "Edit the note, optionally summarize the transcript, then export — indexed to Memory.",
  },
  {
    icon: Trash2,
    title: "Audio is destroyed",
    body: "The raw recording is deleted the instant transcription finishes. It never touches the database.",
  },
];

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { patient } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("patients")
    .select("id, full_name, status")
    .order("full_name")
    .returns<PatientOption[]>();
  const patients = data ?? [];

  const defaultPatientId =
    patient && patients.some((p) => p.id === patient) ? patient : null;

  return (
    <div>
      <PageHeading
        title="New"
        accent="session"
        subtitle="Audio is processed transiently — transcribed on the server and deleted the moment your structured note exists."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AudioRecorder patients={patients} defaultPatientId={defaultPatientId} />
        </div>

        {/* Side panel — what happens next */}
        <aside className="lg:col-span-2">
          <div className="glass rounded-3xl p-6">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              What happens next
            </h2>
            <ol className="mt-5 space-y-5">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                      <Icon className="size-4" />
                    </div>
                    {i < STEPS.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
