"use client";

/**
 * While a session is processing, poll its status. When it flips to ready or
 * failed we refresh the page AND raise a browser notification, so the
 * clinician can walk away during the (slow) Whisper large-v3 transcription
 * and be pinged the moment the note is ready.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Bell } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import type { SessionStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function ProcessingPoller({
  sessionId,
  title,
}: {
  sessionId: string;
  title: string;
}) {
  const router = useRouter();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  useEffect(() => {
    const supabase = createClient();
    let done = false;

    async function check() {
      const { data } = await supabase
        .from("sessions")
        .select("status")
        .eq("id", sessionId)
        .maybeSingle<{ status: SessionStatus }>();

      if (!data || data.status === "processing" || done) return;
      done = true;

      // Sessions auto-export, so a finished one is "ready" or "exported".
      const ready = data.status === "ready" || data.status === "exported";
      if (ready)
        toast.success("Transcription complete", `“${title}” is ready and saved to Memory.`);
      else toast.error("Transcription failed", `“${title}” could not be transcribed.`);

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(ready ? "Aura — note ready" : "Aura — transcription failed", {
          body: ready
            ? `“${title}” has been transcribed and structured.`
            : `“${title}” could not be transcribed.`,
        });
      }
      router.refresh();
    }

    const id = setInterval(check, 4000);
    return () => clearInterval(id);
  }, [sessionId, title, router]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  }

  return (
    <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6">
      <div className="flex items-center gap-4">
        <span className="relative flex size-3">
          <motion.span
            className="absolute inline-flex size-full rounded-full bg-amber-500"
            animate={{ scale: [1, 2], opacity: [0.5, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          />
          <span className="relative inline-flex size-3 rounded-full bg-amber-500" />
        </span>
        <p className="text-muted-foreground">
          Transcribing and structuring your session… Whisper large-v3 is
          thorough, so this can take a few minutes. This page updates
          automatically.
        </p>
      </div>

      {permission !== "granted" && (
        <Button variant="secondary" size="sm" onClick={enableNotifications}>
          <Bell />
          Notify me when it&apos;s ready
        </Button>
      )}
    </div>
  );
}
