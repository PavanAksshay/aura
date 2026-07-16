"use client";

/**
 * Opt-in control for background appointment reminders. Once enabled, reminders
 * are delivered by the browser's push service ~10 minutes before a session —
 * so they arrive even with Aura closed.
 */

import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2 } from "lucide-react";

import { disablePush, enablePush, isSubscribed, pushSupported } from "@/lib/push";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

interface PushState {
  supported: boolean;
  on: boolean;
  ready: boolean;
}

export function PushToggle({ userId }: { userId: string }) {
  // Resolved on the client only: push support and the current subscription both
  // depend on browser APIs that don't exist during SSR.
  const [{ supported, on, ready }, setState] = useState<PushState>({
    supported: false,
    on: false,
    ready: false,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const isSupported = pushSupported();
      const subscribed = isSupported ? await isSubscribed() : false;
      if (!cancelled) {
        setState({ supported: isSupported, on: subscribed, ready: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        setState((s) => ({ ...s, on: false }));
        toast.success("Reminders off", "You'll no longer get background alerts.");
      } else {
        const granted = await enablePush(userId);
        if (!granted) {
          toast.error(
            "Notifications blocked",
            "Allow notifications for this site in your browser settings, then try again.",
          );
        } else {
          setState((s) => ({ ...s, on: true }));
          toast.success(
            "Reminders on",
            "You'll be notified 10 minutes before each appointment.",
          );
        }
      }
    } catch (err) {
      toast.error(
        "Could not update reminders",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="glass rounded-3xl p-6">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Appointment reminders
      </h2>

      {!supported ? (
        <p className="mt-3 text-sm text-muted-foreground">
          This browser doesn&apos;t support background notifications. You&apos;ll
          still see in-app reminders while Aura is open.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {on
              ? "On — your browser will alert you 10 minutes before each appointment, even when Aura is closed."
              : "Get a notification 10 minutes before each appointment, even when Aura is closed."}
          </p>
          <Button
            onClick={toggle}
            disabled={busy}
            variant={on ? "secondary" : "default"}
            size="sm"
            className="mt-4"
          >
            {busy ? (
              <Loader2 className="animate-spin" />
            ) : on ? (
              <BellOff />
            ) : (
              <BellRing />
            )}
            {on ? "Turn off reminders" : "Enable reminders"}
          </Button>
        </>
      )}
    </div>
  );
}
