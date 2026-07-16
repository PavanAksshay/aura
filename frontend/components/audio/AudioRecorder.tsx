"use client";

/**
 * The session capture surface: record → review length → submit.
 * On submit the single audio Blob is streamed to the FastAPI backend and
 * dropped from memory; nothing is written to localStorage, IndexedDB, or disk.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { submitRecording } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Patient } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecordingTimer } from "./RecordingTimer";
import { Waveform } from "./Waveform";
import { useAudioRecorder } from "./useAudioRecorder";

export type PatientOption = Pick<Patient, "id" | "full_name" | "status">;

export function AudioRecorder({
  patients = [],
  defaultPatientId = null,
}: {
  patients?: PatientOption[];
  defaultPatientId?: string | null;
}) {
  const router = useRouter();
  const rec = useAudioRecorder();

  const [title, setTitle] = useState("");
  const [patientId, setPatientId] = useState<string>(defaultPatientId ?? "");
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleStop() {
    const blob = await rec.stop();
    if (blob) {
      setPendingBlob(blob);
      setRecordedSeconds(rec.elapsed);
    }
  }

  function discard() {
    setPendingBlob(null);
    setSubmitError(null);
    rec.reset();
  }

  async function handleSubmit() {
    if (!pendingBlob) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { session_id } = await submitRecording(pendingBlob, {
        title: title.trim() || "Untitled session",
        durationSeconds: recordedSeconds,
        patientId: patientId || null,
      });
      setPendingBlob(null); // release the audio buffer
      // Rough ETA: Whisper large-v3 + diarization runs at ~2x realtime on CPU.
      const etaMin = Math.max(1, Math.round((recordedSeconds * 2) / 60));
      toast.info(
        `Note ready in ~${etaMin} min`,
        "Whisper is transcribing on the server. You'll be notified here when it's done — track it on this session page or your dashboard.",
      );
      router.push(`/sessions/${session_id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Upload failed.");
      setSubmitting(false);
    }
  }

  const isRecording = rec.status === "recording";
  const formDisabled = isRecording || submitting;

  return (
    <div className="glass mx-auto max-w-xl rounded-3xl p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="session-title">Session title</Label>
          <Input
            id="session-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Follow-up — anxiety management"
            disabled={formDisabled}
          />
        </div>

        {patients.length > 0 && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="session-patient">Patient</Label>
            <Select
              value={patientId || "none"}
              onValueChange={(v) => setPatientId(v === "none" ? "" : v)}
              disabled={formDisabled}
            >
              <SelectTrigger id="session-patient">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No patient link</SelectItem>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                    {p.status !== "active" ? ` (${p.status})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground/70">
              Linking adds this session to the patient&apos;s timeline and memory.
            </p>
          </div>
        )}
      </div>

      <div className="mt-10 flex flex-col items-center gap-6">
        <RecordingTimer seconds={isRecording ? rec.elapsed : recordedSeconds} />
        <Waveform analyserRef={rec.analyserRef} active={isRecording} />

        <AnimatePresence mode="wait" initial={false}>
          {pendingBlob ? (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex w-full flex-col items-center gap-4"
            >
              <p className="text-center text-sm text-muted-foreground">
                Recording captured. Generate the note, or discard it —
                nothing has left this device yet.
              </p>
              <div className="flex gap-3">
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin" />}
                  {submitting ? "Uploading…" : "Generate note"}
                </Button>
                <Button variant="secondary" onClick={discard} disabled={submitting}>
                  Discard
                </Button>
              </div>
              {submitError && (
                <p role="alert" className="text-sm text-destructive">
                  {submitError}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.button
              key="record"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={isRecording ? handleStop : rec.start}
              disabled={rec.status === "requesting"}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              className="relative flex h-20 w-20 cursor-pointer items-center justify-center rounded-full border-2 border-foreground/15 transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {isRecording && (
                <motion.span
                  className="absolute inset-0 rounded-full border-2 border-rose-500"
                  animate={{ scale: [1, 1.25], opacity: [0.8, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              <motion.span
                layout
                className={
                  isRecording
                    ? "h-7 w-7 rounded-md bg-rose-500" // stop square
                    : "h-9 w-9 rounded-full bg-rose-500" // record dot
                }
              />
            </motion.button>
          )}
        </AnimatePresence>

        <p className="text-sm text-muted-foreground/80">
          {rec.status === "requesting" && "Waiting for microphone permission…"}
          {isRecording && "Recording — ambient session audio is being captured."}
          {rec.status === "idle" && !pendingBlob && "Tap to start recording."}
        </p>
        {rec.error && (
          <p role="alert" className="text-sm text-destructive">
            {rec.error}
          </p>
        )}
      </div>
    </div>
  );
}
