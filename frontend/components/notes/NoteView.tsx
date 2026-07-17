"use client";

/**
 * The generated session note: "What was discussed" and "What lies ahead", each
 * a clean bulleted list. Copy-to-clipboard is the manual export here; sessions
 * auto-export on transcription, so the button is usually just a copy.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Copy, Loader2, MessagesSquare, Route, ShieldCheck } from "lucide-react";

import { exportSession } from "@/lib/api";
import { normalizeNote, noteToText, NOTE_SECTIONS } from "@/lib/note";
import { toast } from "@/lib/toast";
import type { LegacySoapNote, SessionNote } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/components/motion/primitives";

const SECTION_ICON = {
  discussed: MessagesSquare,
  ahead: Route,
} as const;

const EMPTY_COPY = {
  discussed: "Nothing was captured from this session.",
  ahead: "No plans or next steps were agreed.",
} as const;

export function NoteView({
  sessionId,
  note: raw,
  exported,
}: {
  sessionId: string;
  note: SessionNote | LegacySoapNote;
  exported: boolean;
}) {
  const router = useRouter();
  const note = normalizeNote(raw);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const updated = await exportSession(sessionId);
      await navigator.clipboard.writeText(
        noteToText(normalizeNote(updated.note ?? raw)),
      );
      setCopied(true);
      toast.success("Note exported", "Copied to clipboard and indexed to Memory.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyOnly() {
    await navigator.clipboard.writeText(noteToText(note));
    setCopied(true);
    toast.success("Note copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {NOTE_SECTIONS.map(({ key, label }, i) => {
          const Icon = SECTION_ICON[key];
          const items = note[key];
          return (
            <motion.section
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE_OUT, delay: i * 0.08 }}
              className="glass rounded-2xl p-6"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Icon className="size-3.5" />
                </span>
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-primary">
                  {label}
                </h2>
              </div>
              {items.length > 0 ? (
                <ul className="mt-4 space-y-2.5">
                  {items.map((bullet, j) => (
                    <li key={j} className="flex gap-2.5">
                      <span
                        aria-hidden
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/50"
                      />
                      <span className="text-sm leading-relaxed text-foreground/90">
                        {bullet}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  {EMPTY_COPY[key]}
                </p>
              )}
            </motion.section>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        {exported ? (
          <Button variant="secondary" onClick={handleCopyOnly}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy note"}
          </Button>
        ) : (
          <Button onClick={handleExport} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            {busy ? "Exporting…" : "Export note"}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!exported && (
          <p className="text-sm text-muted-foreground">
            Exporting copies the note and indexes it into Memory.
          </p>
        )}
      </div>
    </div>
  );
}
