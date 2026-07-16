"use client";

/**
 * Reminds the clinician ~10 minutes before each scheduled appointment starts,
 * with an in-app toast (and a browser notification if they've granted it).
 *
 * Polls the RLS-scoped appointments table every 60s and fires each reminder
 * exactly once. Because this runs in the browser, reminders only fire while
 * Aura is open in a tab — it's a heads-up, not a guaranteed background alert.
 * Fired ids are persisted to sessionStorage so navigating between tabs doesn't
 * replay a reminder that already showed.
 */

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

const LEAD_MS = 10 * 60 * 1000; // remind 10 minutes ahead
const STORE_KEY = "aura:appt-reminders-fired";

interface Row {
  id: string;
  title: string;
  starts_at: string;
  status: string;
}

function loadFired(): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    return new Set(JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function AppointmentReminder() {
  const fired = useRef<Set<string>>(loadFired());

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    function persist() {
      try {
        sessionStorage.setItem(STORE_KEY, JSON.stringify([...fired.current]));
      } catch {
        // sessionStorage unavailable (private mode) — reminders still fire,
        // they just aren't de-duped across remounts. Acceptable.
      }
    }

    async function poll() {
      const nowMs = Date.now();
      // Only look at appointments starting within the next 10 minutes that
      // haven't already begun. Small window → tiny result set.
      const windowEnd = new Date(nowMs + LEAD_MS).toISOString();
      const now = new Date(nowMs).toISOString();

      const { data } = await supabase
        .from("appointments")
        .select("id, title, starts_at, status")
        .eq("status", "scheduled")
        .gte("starts_at", now)
        .lte("starts_at", windowEnd)
        .returns<Row[]>();
      if (!active || !data) return;

      for (const appt of data) {
        if (fired.current.has(appt.id)) continue;
        fired.current.add(appt.id);

        const mins = Math.max(
          1,
          Math.round((new Date(appt.starts_at).getTime() - nowMs) / 60000),
        );
        const when = new Date(appt.starts_at).toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });
        toast.info(
          "Appointment soon",
          `“${appt.title}” starts in ${mins} min (${when}).`,
        );
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification("Aura — appointment soon", {
            body: `“${appt.title}” starts in ${mins} min (${when}).`,
          });
        }
      }
      persist();
    }

    void poll();
    const interval = setInterval(poll, 60_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return null;
}
