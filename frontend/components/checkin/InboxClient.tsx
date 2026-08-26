"use client";

/**
 * Operator-only inbox for daily check-in messages. Lists everything newest
 * first, and a reply box on each unanswered message; sending a reply pushes it
 * back to the person who wrote in. The backend gates every call on owner_email,
 * so this UI is only ever a convenience, never the access control.
 */

import { useEffect, useState } from "react";
import { Loader2, MessageSquareReply, RefreshCw } from "lucide-react";

import {
  getCheckinInbox,
  replyToCheckin,
  type CheckinInboxItem,
} from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function InboxClient() {
  const [items, setItems] = useState<CheckinInboxItem[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await getCheckinInbox();
      setItems(data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("token") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("expired")) {
        setError("Sign-in required to view check-in inbox.");
      } else {
        setError(msg || "Could not load messages.");
      }
      setItems([]);
    }
  }

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, []);

  async function send(id: string) {
    const reply = (drafts[id] ?? "").trim();
    if (!reply) return;
    setSending(id);
    try {
      await replyToCheckin(id, reply);
      setDrafts((d) => ({ ...d, [id]: "" }));
      toast.success("Reply sent", "Notification queued for delivery.");
      await load();
    } catch (err) {
      toast.error(
        "Could not send reply",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setSending(null);
    }
  }

  if (items === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading messages…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {items.length} message{items.length === 1 ? "" : "s"}
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {items.length === 0 && !error && (
        <p className="rounded-md border border-border bg-card p-5 text-xs text-muted-foreground">
          No messages yet.
        </p>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-md border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-xs font-bold text-foreground">
                {item.name ?? "Someone"}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {formatWhen(item.created_at)}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Feeling: {item.mood}
            </p>

            {item.message && (
              <p className="mt-2.5 whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
                {item.message}
              </p>
            )}

            {item.owner_reply ? (
              <div className="mt-2.5 rounded-md border border-primary/30 bg-primary/5 p-3">
                <p className="text-[11px] font-bold text-primary">
                  Your reply
                  {item.owner_replied_at
                    ? ` · ${formatWhen(item.owner_replied_at)}`
                    : ""}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                  {item.owner_reply}
                </p>
              </div>
            ) : (
              <div className="mt-2.5">
                <textarea
                  value={drafts[item.id] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [item.id]: e.target.value }))
                  }
                  rows={2}
                  placeholder="Write a reply…"
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed outline-none focus:border-primary"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    disabled={
                      sending === item.id ||
                      (drafts[item.id] ?? "").trim().length === 0
                    }
                    onClick={() => send(item.id)}
                  >
                    {sending === item.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <MessageSquareReply className="size-3.5" />
                    )}
                    Send reply
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
