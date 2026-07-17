"use client";

/**
 * Vertical session history for one patient: a gradient spine draws itself in,
 * then each session node cascades into place. A node expands in place to reveal
 * the structured summary and full transcript, so a clinician can review a
 * session's content without leaving the patient's profile. A link to the full
 * note view stays available inside the expanded panel.
 */

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, Mic } from "lucide-react";

import { normalizeNote, NOTE_SECTIONS } from "@/lib/note";
import type { ClinicalSession } from "@/lib/types";
import { Badge, SESSION_STATUS_TONE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/components/motion/primitives";
import { SessionDocPreview } from "@/components/notes/SessionDocPreview";
import { SessionNotes } from "@/components/patients/SessionNotes";

type TimelineSession = Pick<
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

const NODE_COLOR: Record<TimelineSession["status"], string> = {
  processing: "bg-amber-500",
  ready: "bg-primary",
  exported: "bg-muted-foreground",
  failed: "bg-destructive",
};

function duration(seconds: number | null): string | null {
  if (!seconds) return null;
  const m = Math.round(seconds / 60);
  return m < 1 ? "<1 min" : `${m} min`;
}

export function SessionTimeline({
  sessions,
  patientId,
  patientName,
}: {
  sessions: TimelineSession[];
  patientId: string;
  patientName: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="glass-subtle flex flex-col items-center rounded-3xl px-8 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Mic className="size-6" />
        </div>
        <p className="mt-4 font-display font-semibold">No sessions yet</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Record a session with this patient and it will appear here as a
          timeline of their care.
        </p>
        <Button asChild className="mt-6" size="sm">
          <Link href={`/sessions/new?patient=${patientId}`}>
            <Mic />
            Record first session
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative pl-7">
      {/* Gradient spine */}
      <motion.span
        aria-hidden
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.9, ease: EASE_OUT }}
        className="absolute inset-y-1 left-2 w-px origin-top bg-linear-to-b from-aurora-cyan via-aurora-teal to-transparent"
      />

      <ol className="space-y-4">
        {sessions.map((s, i) => {
          const open = openId === s.id;
          return (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.45,
                ease: EASE_OUT,
                delay: 0.15 + Math.min(i * 0.08, 0.7),
              }}
              className="relative"
            >
              {/* Node dot */}
              <span
                aria-hidden
                className={`absolute -left-7 top-5 ml-[3px] size-2.5 rounded-full ${NODE_COLOR[s.status]}`}
              >
                {s.status === "processing" && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-amber-500"
                    animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
              </span>

              <div className="glass-subtle overflow-hidden rounded-2xl">
                {/* Always expandable: even a session with no transcript yet has
                    a notes space worth opening. */}
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : s.id)}
                  aria-expanded={open}
                  className="block w-full cursor-pointer px-5 py-4 text-left transition-colors duration-200 hover:bg-foreground/6"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {duration(s.audio_duration_seconds) && (
                          <> · {duration(s.audio_duration_seconds)}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Badge tone={SESSION_STATUS_TONE[s.status]}>{s.status}</Badge>
                      <ChevronDown
                        className={`size-4 text-muted-foreground transition-transform duration-200 ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>
                  {!open && s.summary?.discussion && (
                    <p className="mt-2.5 line-clamp-2 border-t border-border pt-2.5 text-sm leading-relaxed text-muted-foreground">
                      {s.summary.discussion}
                    </p>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 border-t border-border px-5 py-4">
                        {s.note && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {NOTE_SECTIONS.map(({ key, label }) => {
                              const items = normalizeNote(s.note)[key];
                              return (
                                <div
                                  key={key}
                                  className="rounded-xl bg-foreground/[0.03] p-3"
                                >
                                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    {label}
                                  </p>
                                  {items.length > 0 ? (
                                    <ul className="space-y-1.5">
                                      {items.map((bullet, j) => (
                                        <li key={j} className="flex gap-2">
                                          <span
                                            aria-hidden
                                            className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/50"
                                          />
                                          <span className="text-sm leading-relaxed text-foreground/85">
                                            {bullet}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">—</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {s.raw_transcript && (
                          <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Transcript
                            </p>
                            <p className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-foreground/[0.03] p-3 text-sm leading-relaxed text-foreground/80">
                              {s.raw_transcript}
                            </p>
                          </div>
                        )}

                        <SessionNotes
                          sessionId={s.id}
                          initialNotes={s.clinician_notes}
                        />

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {s.raw_transcript && (
                            <SessionDocPreview
                              kind="Transcript"
                              sessionTitle={s.title}
                              patientName={patientName}
                              dateISO={s.created_at}
                              transcript={s.raw_transcript}
                            />
                          )}
                          {s.note && (
                            <SessionDocPreview
                              kind="Summary"
                              sessionTitle={s.title}
                              patientName={patientName}
                              dateISO={s.created_at}
                              note={s.note}
                            />
                          )}
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/sessions/${s.id}`}>
                              Open full note
                              <ExternalLink />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
