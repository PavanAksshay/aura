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
      setError(err instanceof Error ? err.message : "Could not load messages.");
      setItems([]);
    }
  }

  useEffect(() => {
    // Async so the first setState lands after an await, not synchronously in
    // the effect body (which the react-hooks rule flags).
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
      toast.success("Reply sent", "She'll be notified right away.");
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading messages…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} message{items.length === 1 ? "" : "s"}
        </p>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {items.length === 0 && !error && (
        <p className="rounded-2xl border border-border/60 bg-background/40 p-6 text-sm text-muted-foreground">
          No messages yet.
        </p>
      )}

      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id} className="glass rounded-2xl border border-border/60 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-display font-semibold tracking-tight">
                {item.name ?? "Someone"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatWhen(item.created_at)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Feeling: {item.mood}
            </p>

            {item.message && (
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-foreground/5 p-3 text-sm leading-relaxed">
                {item.message}
              </p>
            )}

            {item.owner_reply ? (
              <div className="mt-3 rounded-xl border border-primary/25 bg-primary/8 p-3">
                <p className="text-xs font-medium text-primary">
                  Your reply
                  {item.owner_replied_at
                    ? ` · ${formatWhen(item.owner_replied_at)}`
                    : ""}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {item.owner_reply}
                </p>
              </div>
            ) : (
              <div className="mt-3">
                <textarea
                  value={drafts[item.id] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [item.id]: e.target.value }))
                  }
                  rows={2}
                  placeholder="Write a reply…"
                  className="w-full resize-y rounded-xl border border-border bg-background/60 px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary"
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
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MessageSquareReply className="size-4" />
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
