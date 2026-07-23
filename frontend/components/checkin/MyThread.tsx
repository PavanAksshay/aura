"use client";

/**
 * The check-in user's own conversation with Aura: her messages and Aura's
 * replies, oldest first. Everything on this side is attributed to Aura — she is
 * never shown, and must never learn, that a person writes the replies.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { getCheckinThread, type CheckinThreadItem } from "@/lib/api";
import { AuraMark } from "@/components/ui/aura-logo";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function MyThread() {
  const [items, setItems] = useState<CheckinThreadItem[] | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await getCheckinThread();
        // Oldest first reads like a conversation; only entries she wrote in.
        setItems(data.filter((d) => d.message).reverse());
      } catch {
        setItems([]);
      }
    })();
  }, []);

  if (items === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-border/60 bg-background/40 p-6 text-sm text-muted-foreground">
        Nothing here yet. Whenever you want to talk, I&apos;m here in your daily
        check-in.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {items.map((item) => (
        <div key={item.id} className="space-y-2">
          <p className="text-center text-xs text-muted-foreground">
            {formatWhen(item.created_at)}
          </p>

          {/* Her message */}
          {item.message && (
            <div className="flex justify-end">
              <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary/15 px-4 py-2.5 text-sm leading-relaxed">
                {item.message}
              </p>
            </div>
          )}

          {/* Aura's reply */}
          {item.owner_reply && (
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/12">
                <AuraMark className="size-4" />
              </span>
              <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-md bg-foreground/5 px-4 py-2.5 text-sm leading-relaxed">
                {item.owner_reply}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
