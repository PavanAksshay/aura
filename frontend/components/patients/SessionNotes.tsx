"use client";

/**
 * The therapist's own notes on a session — their space, alongside the
 * generated SOAP note and the verbatim transcript. Saves straight to Supabase
 * under RLS (owner-only), like the rest of the app's CRUD.
 *
 * Explicit save rather than autosave: clinical notes shouldn't be committed on
 * every keystroke, and an unsaved-changes marker is clearer than a silent write.
 */

import { useState } from "react";
import { Check, Loader2, NotebookPen } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function SessionNotes({
  sessionId,
  initialNotes,
}: {
  sessionId: string;
  initialNotes: string | null;
}) {
  const [saved, setSaved] = useState(initialNotes ?? "");
  const [draft, setDraft] = useState(initialNotes ?? "");
  const [busy, setBusy] = useState(false);

  const dirty = draft !== saved;

  async function save() {
    setBusy(true);
    const next = draft.trim();
    const { error } = await createClient()
      .from("sessions")
      .update({ clinician_notes: next || null })
      .eq("id", sessionId);
    setBusy(false);

    if (error) {
      toast.error("Could not save notes", error.message);
      return;
    }
    setSaved(next);
    setDraft(next);
    toast.success("Notes saved");
  }

  return (
    <div className="rounded-xl bg-foreground/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <NotebookPen className="size-3.5" />
          Your notes
        </p>
        {!dirty && saved.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground/70">
            <Check className="size-3" />
            Saved
          </span>
        )}
      </div>

      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        placeholder="Reflections, follow-ups, anything worth remembering from this session…"
        aria-label="Your notes for this session"
        className="resize-y"
      />

      <div className="mt-2 flex items-center justify-end gap-2">
        {dirty && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDraft(saved)}
            disabled={busy}
          >
            Discard
          </Button>
        )}
        <Button size="sm" onClick={save} disabled={busy || !dirty}>
          {busy ? <Loader2 className="animate-spin" /> : <NotebookPen />}
          {dirty ? "Save notes" : "Saved"}
        </Button>
      </div>
    </div>
  );
}
