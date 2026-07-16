"use client";

/**
 * Watches the clinician's recent sessions and raises an in-app toast the moment
 * a recording finishes processing — so they're told "your note is ready" even
 * if they've navigated away from the session page while Whisper works.
 *
 * Lightweight: polls the (RLS-scoped) recent sessions every 12s and toasts only
 * on a processing → ready/failed transition it actually observes.
 */

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

interface Row {
  id: string;
  title: string;
  status: string;
}

export function SessionWatcher() {
  const seen = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function poll() {
      const { data } = await supabase
        .from("sessions")
        .select("id, title, status")
        .order("created_at", { ascending: false })
        .limit(12)
        .returns<Row[]>();
      if (!active || !data) return;

      const prev = seen.current;
      // First run just records a baseline — no toasts for already-done work.
      if (prev) {
        for (const row of data) {
          if (prev.get(row.id) !== "processing") continue;
          // Sessions auto-export, so a finished one lands on "ready" or
          // "exported" — either means the note is done.
          if (row.status === "ready" || row.status === "exported") {
            toast.success(
              "Session note ready",
              `“${row.title}” has been transcribed and saved to Memory.`,
            );
          } else if (row.status === "failed") {
            toast.error(
              "Transcription failed",
              `“${row.title}” could not be processed.`,
            );
          }
        }
      }
      seen.current = new Map(data.map((r) => [r.id, r.status]));
    }

    void poll();
    const interval = setInterval(poll, 12_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return null;
}
