"use client";

/**
 * Tells the clinician, plainly, when Aura's processing service is unreachable.
 *
 * Aura's backend is a machine the clinician runs; it will legitimately be off
 * some of the time. Without this the app looks broken — buttons that do
 * nothing, spinners that never end — and the natural fear in a clinical tool
 * is that notes were lost. So the banner leads with what is still safe.
 *
 * Deliberately a banner and not a blocking screen: everything served from
 * Supabase (patients, past notes, schedule, typed notes) keeps working while
 * the backend is down. Only recording, summarising, and Memory need it. Taking
 * the whole app away would remove access to records that are perfectly fine.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloudOff, RefreshCw } from "lucide-react";

import { pingBackend } from "@/lib/api";
import { EASE_OUT } from "@/components/motion/primitives";

// Slow enough to be invisible when healthy, fast enough that recovery is
// noticed without a manual reload.
const POLL_HEALTHY_MS = 60_000;
const POLL_DOWN_MS = 15_000;

export function MaintenanceBanner() {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      const ok = await pingBackend();
      if (cancelled) return;
      setOffline(!ok);
      timer = setTimeout(check, ok ? POLL_HEALTHY_MS : POLL_DOWN_MS);
    };

    void check();

    // A tab that slept for hours holds a stale verdict; re-check on return.
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const retry = async () => {
    setChecking(true);
    const ok = await pingBackend();
    setOffline(!ok);
    setChecking(false);
  };

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="overflow-hidden px-2 pt-2 sm:px-4"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:gap-4">
            <CloudOff
              aria-hidden
              className="size-5 shrink-0 text-amber-600 dark:text-amber-400"
            />
            <p className="min-w-0 flex-1 text-sm font-medium">
              Sorry for the inconvenience caused. App is down for maintenance.
              Please try again later
            </p>
            <button
              type="button"
              onClick={retry}
              disabled={checking}
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-amber-500/40 px-3 py-1.5 text-sm font-medium transition hover:bg-amber-500/15 disabled:opacity-60 sm:self-auto"
            >
              <RefreshCw
                aria-hidden
                className={`size-4 ${checking ? "animate-spin" : ""}`}
              />
              {checking ? "Checking…" : "Check again"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
