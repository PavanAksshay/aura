"use client";

/**
 * Full transcript beside its structured summary. The transcript can be
 * downloaded as a .txt file; the summary is generated on demand by a local
 * model (Ollama, with a heuristic fallback) and persisted server-side.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Download, Loader2, Sparkles, User } from "lucide-react";

import { summarizeSession, swapSpeakers } from "@/lib/api";
import { buildTextHeader } from "@/lib/session-export";
import { toast } from "@/lib/toast";
import type { SessionSummary } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "session";
}

export function TranscriptPanel({
  sessionId,
  title,
  transcript,
  initialSummary,
  patientName,
  dateISO,
}: {
  sessionId: string;
  title: string;
  transcript: string;
  initialSummary: SessionSummary | null;
  patientName: string | null;
  dateISO: string;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState<SessionSummary | null>(initialSummary);
  const [swapping, setSwapping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function downloadTxt() {
    // Same header as the PDF — see lib/session-export.ts.
    const header = buildTextHeader({
      sessionTitle: title,
      patientName,
      kind: "Transcript",
      dateISO,
    });
    const blob = new Blob([header + transcript], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(title)}-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transcript downloaded");
  }

  async function summarize() {
    setBusy(true);
    setError(null);
    try {
      setSummary(await summarizeSession(sessionId));
      toast.success("Summary ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not summarize.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSwapSpeakers() {
    setSwapping(true);
    try {
      await swapSpeakers(sessionId);
      toast.success(
        "Speaker labels swapped",
        "The note was redrafted from the corrected transcript — please review it again.",
      );
      router.refresh();
    } catch (err) {
      toast.error(
        "Could not swap speakers",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setSwapping(false);
    }
  }

  // Only meaningful when diarization actually produced role labels.
  const hasRoleLabels = /^(Therapist|Patient):/m.test(transcript);

  const details: { label: string; value: string }[] = summary
    ? [
        { label: "Name", value: summary.patient_name },
        { label: "Age", value: summary.age },
        { label: "Details", value: summary.personal_details },
      ].filter((d) => d.value.trim())
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Transcript */}
      <div className="rounded-md border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Full transcript
          </h3>
          <Button variant="outline" size="sm" onClick={downloadTxt}>
            <Download className="size-3.5" />
            Download .txt
          </Button>
        </div>
        <p className="max-h-96 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground font-mono">
          {transcript}
        </p>
        {/* Diarization separates voices but cannot tell who is the clinician;
            it assumes whoever speaks first is the therapist. When that is
            wrong, every line is attributed to the wrong person. */}
        {hasRoleLabels && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              Labels are a guess based on who spoke first. If they are the wrong
              way round, swap them — the note will be redrafted to match.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSwapSpeakers}
              disabled={swapping}
            >
              {swapping ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ArrowLeftRight className="size-3.5" />
              )}
              {swapping ? "Redrafting…" : "Swap speakers"}
            </Button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="rounded-md border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Summary
          </h3>
          <Button size="sm" onClick={summarize} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles className="size-3.5" />}
            {summary ? "Regenerate" : "Summarize"}
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {!summary && !busy && !error && (
          <p className="text-sm text-muted-foreground">
            Generate a structured summary — patient details and what was
            discussed — from the transcript. Runs locally on your machine.
          </p>
        )}

        {busy && !summary && (
          <p className="text-sm text-muted-foreground">
            Summarizing on-device… this can take a moment.
          </p>
        )}

        {summary && (
          <div className="space-y-4">
            {details.length > 0 ? (
              <div className="rounded-xl border border-border bg-foreground/[0.03] p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <User className="size-3.5" />
                  Patient details
                </div>
                <dl className="space-y-1 text-sm">
                  {details.map((d) => (
                    <div key={d.label} className="flex gap-2">
                      <dt className="w-16 shrink-0 text-muted-foreground">
                        {d.label}
                      </dt>
                      <dd className="text-foreground/90">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No explicit patient details were stated in the transcript.
              </p>
            )}

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Discussion
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">
                {summary.discussion || "—"}
              </p>
            </div>

            <Badge tone={summary.engine === "ollama" ? "accent" : "muted"}>
              {summary.engine === "ollama" ? "Local LLM" : "Heuristic"}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
