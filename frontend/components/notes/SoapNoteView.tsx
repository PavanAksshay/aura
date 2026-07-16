"use client";

/**
 * SOAP note review surface. Copy-to-clipboard is the "export" in this
 * scaffold — invoking it also triggers the server-side purge of the raw
 * transcript, so the UI makes that consequence explicit before acting.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Copy, Loader2, ShieldCheck } from "lucide-react";

import { exportSession } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { SoapNote } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/components/motion/primitives";

const SECTIONS: { key: keyof SoapNote; label: string }[] = [
  { key: "subjective", label: "Subjective" },
  { key: "objective", label: "Objective" },
  { key: "assessment", label: "Assessment" },
  { key: "plan", label: "Plan" },
];

function noteToText(note: SoapNote): string {
  return SECTIONS.map(({ key, label }) => `${label}:\n${note[key]}`).join("\n\n");
}

export function SoapNoteView({
  sessionId,
  note,
  exported,
}: {
  sessionId: string;
  note: SoapNote;
  exported: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const updated = await exportSession(sessionId);
      await navigator.clipboard.writeText(noteToText(updated.soap ?? note));
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
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map(({ key, label }, i) => (
        <motion.section
          key={key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT, delay: i * 0.08 }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 font-display text-xs font-semibold text-primary">
              {label[0]}
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
              {label}
            </h2>
          </div>
          <p className="mt-3 whitespace-pre-wrap leading-relaxed text-foreground/90">
            {note[key]}
          </p>
        </motion.section>
      ))}

      <div className="flex flex-wrap items-center gap-4 pt-2">
        {exported ? (
          <Button variant="secondary" onClick={handleCopyOnly}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy note"}
          </Button>
        ) : (
          <Button onClick={handleExport} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            {busy ? "Exporting…" : "Export note (purges transcript)"}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!exported && (
          <p className="text-sm text-muted-foreground">
            Exporting copies the note and permanently deletes the raw transcript.
          </p>
        )}
      </div>
    </div>
  );
}
