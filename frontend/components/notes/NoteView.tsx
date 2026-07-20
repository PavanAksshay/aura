"use client";

/**
 * The generated session note: "What was discussed" and "What lies ahead", each
 * a clean bulleted list. Copy-to-clipboard is the manual export here; sessions
 * auto-export on transcription, so the button is usually just a copy.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Copy,
  Loader2,
  MessagesSquare,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import {
  exportSession,
  regenerateNote,
  reviewSession,
  updateNote,
} from "@/lib/api";
import {
  normalizeNote,
  noteToText,
  NOTE_SECTIONS,
  type NoteSectionKey,
} from "@/lib/note";
import { toast } from "@/lib/toast";
import type { LegacySoapNote, SessionNote } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/components/motion/primitives";

const SECTION_ICON = {
  discussed: MessagesSquare,
  ahead: Route,
} as const;

/** Wall-clock formatting kept out of render so the component stays pure. */
function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const EMPTY_COPY = {
  discussed: "Nothing was captured from this session.",
  ahead: "No plans or next steps were agreed.",
} as const;

export function NoteView({
  sessionId,
  note: raw,
  exported,
  reviewedAt,
  noteEditedAt,
}: {
  sessionId: string;
  note: SessionNote | LegacySoapNote;
  exported: boolean;
  /** ISO timestamp of clinician attestation; null = unverified AI draft. */
  reviewedAt?: string | null;
  /** When the note was last hand-corrected; null = still as the model wrote it. */
  noteEditedAt?: string | null;
}) {
  const router = useRouter();
  const note = normalizeNote(raw);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reviewed, setReviewed] = useState<string | null>(reviewedAt ?? null);
  const [reviewing, setReviewing] = useState(false);
  const [edited, setEdited] = useState<string | null>(noteEditedAt ?? null);
  // Draft state lives here only while editing; `note` stays the saved truth.
  const [draft, setDraft] = useState<SessionNote | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  function startEditing() {
    setDraft({ discussed: [...note.discussed], ahead: [...note.ahead] });
  }

  function setBullet(key: NoteSectionKey, index: number, value: string) {
    setDraft((d) =>
      d ? { ...d, [key]: d[key].map((b, i) => (i === index ? value : b)) } : d,
    );
  }

  function addBullet(key: NoteSectionKey) {
    setDraft((d) => (d ? { ...d, [key]: [...d[key], ""] } : d));
  }

  function removeBullet(key: NoteSectionKey, index: number) {
    setDraft((d) =>
      d ? { ...d, [key]: d[key].filter((_, i) => i !== index) } : d,
    );
  }

  async function saveEdits() {
    if (!draft) return;
    setSaving(true);
    try {
      // Blank rows are how you delete a bullet by clearing it; drop them
      // rather than writing empty bullets into a clinical record.
      const cleaned = {
        discussed: draft.discussed.map((b) => b.trim()).filter(Boolean),
        ahead: draft.ahead.map((b) => b.trim()).filter(Boolean),
      };
      const updated = await updateNote(sessionId, cleaned);
      setEdited(updated.note_edited_at ?? new Date().toISOString());
      setReviewed(null); // the server cleared it; the note changed
      setDraft(null);
      toast.success(
        "Note updated",
        "Memory was re-indexed. Mark it reviewed when you're happy with it.",
      );
      router.refresh();
    } catch (err) {
      toast.error(
        "Could not save the note",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await regenerateNote(sessionId);
      setReviewed(null);
      setEdited(null);
      setDraft(null);
      toast.success(
        "Note redrafted",
        "A fresh draft from the same transcript — check it before relying on it.",
      );
      router.refresh();
    } catch (err) {
      toast.error(
        "Could not redraft the note",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setRegenerating(false);
    }
  }

  async function handleReview() {
    setReviewing(true);
    try {
      const updated = await reviewSession(sessionId);
      setReviewed(updated.reviewed_at ?? new Date().toISOString());
      toast.success("Note marked as reviewed");
      router.refresh();
    } catch (err) {
      toast.error(
        "Could not save your review",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setReviewing(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const updated = await exportSession(sessionId);
      await navigator.clipboard.writeText(
        noteToText(normalizeNote(updated.note ?? raw)),
      );
      setCopied(true);
      toast.success(
        "Note exported",
        "Copied to clipboard and indexed to Memory.",
      );
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
      {/* The note is drafted by a local model and indexed into Memory without
          anyone reading it first. Say so, until a clinician says otherwise. */}
      {reviewed ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <BadgeCheck aria-hidden className="size-4 text-primary" />
          Reviewed by you on {formatReviewDate(reviewed)}
          {edited && <span>· edited {formatReviewDate(edited)}</span>}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle
            aria-hidden
            className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <p className="min-w-0 flex-1 text-sm">
            <strong className="font-medium">
              AI draft — not yet reviewed.
            </strong>{" "}
            Aura wrote this from the recording. Check it against what happened
            before relying on it.
          </p>
          <Button size="sm" onClick={handleReview} disabled={reviewing}>
            {reviewing ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
            {reviewing ? "Saving…" : "Mark as reviewed"}
          </Button>
        </div>
      )}

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
              {draft ? (
                <div className="mt-4 space-y-2">
                  {draft[key].map((bullet, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <textarea
                        value={bullet}
                        onChange={(e) => setBullet(key, j, e.target.value)}
                        rows={2}
                        aria-label={`${label} — point ${j + 1}`}
                        className="min-h-[3.25rem] w-full resize-y rounded-lg border border-border bg-background/60 px-3 py-2 text-base leading-relaxed outline-none focus:border-primary sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeBullet(key, j)}
                        aria-label={`Remove point ${j + 1}`}
                        className="mt-2 rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addBullet(key)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-primary transition hover:bg-primary/10"
                  >
                    <Plus className="size-4" />
                    Add a point
                  </button>
                </div>
              ) : items.length > 0 ? (
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

      {draft ? (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button onClick={saveEdits} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setDraft(null)}
            disabled={saving}
          >
            <X />
            Cancel
          </Button>
          <p className="text-sm text-muted-foreground">
            Saving replaces the note and re-indexes Memory.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Button variant="secondary" onClick={startEditing}>
            <Pencil />
            Edit note
          </Button>
          {/* Redrafting is a second roll of the dice, not a fix — decoding is
            non-deterministic, so it can just as easily introduce a new error.
            Hence the plain warning rather than a cheerful "improve" button. */}
          <Button
            variant="secondary"
            onClick={handleRegenerate}
            disabled={regenerating}
            title="Discards the current note, including your edits"
          >
            {regenerating ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            {regenerating ? "Redrafting…" : "Redraft with AI"}
          </Button>
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
      )}
    </div>
  );
}
