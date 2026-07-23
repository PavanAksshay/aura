"use client";

/**
 * A once-a-day well-being check-in for one specific user (gated by email both
 * here and, authoritatively, on the backend). After onboarding, on her first
 * visit each local day, Aura greets her, asks how she is, and offers to pass a
 * message to the operator — who is notified and replies, which surfaces back
 * here (and pushes to her).
 *
 * No other account ever calls the API: the email guard below means the effect
 * is a no-op for everyone else.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";

import {
  getCheckinState,
  markReplySeen,
  submitCheckin,
  type CheckinReply,
} from "@/lib/api";
import { isCheckinEmail } from "@/lib/checkin-user";
import { AuraMark } from "@/components/ui/aura-logo";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/components/motion/primitives";

const GREETING_NAME = "Chandhana";

const MOODS = [
  "Good",
  "Great",
  "Never felt better",
  "Nah, i don't wan't to talk about it",
] as const;

/** Her local calendar day as YYYY-MM-DD (en-CA formats exactly that). */
function localDay(): string {
  return new Date().toLocaleDateString("en-CA");
}

type Step = "reply" | "greeting" | "askMore" | "write" | "thanks";

export function DailyCheckin({ userEmail }: { userEmail: string | null }) {
  const isUser = isCheckinEmail(userEmail);

  const [step, setStep] = useState<Step | null>(null);
  const [reply, setReply] = useState<CheckinReply | null>(null);
  const [firstTime, setFirstTime] = useState(false);
  const [mood, setMood] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isUser) return;
    let cancelled = false;
    void (async () => {
      try {
        const state = await getCheckinState(localDay());
        if (cancelled || !state.enabled) return;
        setFirstTime(state.first_time);
        if (state.pending_reply) {
          setReply(state.pending_reply);
          setStep("reply");
        } else if (!state.done_today) {
          setStep("greeting");
        }
      } catch {
        // Backend unreachable — simply don't prompt today.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isUser]);

  if (!isUser || step === null) return null;

  function close() {
    setStep(null);
  }

  async function dismissReply() {
    if (reply) {
      try {
        await markReplySeen(reply.id);
      } catch {
        // best-effort; she still saw it
      }
    }
    setReply(null);
    close();
  }

  function pickMood(m: string) {
    setMood(m);
    setStep("askMore");
  }

  async function send(message: string | null) {
    if (!mood) return;
    setBusy(true);
    try {
      await submitCheckin({ mood, message, localDate: localDay() });
      if (message) {
        setStep("thanks");
      } else {
        close();
      }
    } catch {
      // Don't trap her in a broken modal if the backend is down.
      close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Daily check-in"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          className="glass relative w-[min(30rem,calc(100vw-2rem))] rounded-3xl border border-border/60 p-6 shadow-2xl sm:p-8"
        >
          {step !== "thanks" && (
            <button
              type="button"
              onClick={step === "reply" ? dismissReply : close}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition hover:bg-foreground/8 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}

          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12">
              <AuraMark className="size-5" />
            </span>
            <span className="font-display text-sm font-semibold tracking-wide text-primary">
              Aura
            </span>
          </div>

          {step === "reply" && reply && (
            <div>
              <p className="text-sm text-muted-foreground">Aura replied to you</p>
              <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-primary/8 p-4 text-base leading-relaxed">
                {reply.reply}
              </p>
              <div className="mt-6 flex justify-end">
                <Button onClick={dismissReply}>Thanks</Button>
              </div>
            </div>
          )}

          {step === "greeting" && (
            <div>
              <p className="font-display text-xl font-semibold tracking-tight">
                {firstTime
                  ? `Hi ${GREETING_NAME}, I'm Aura.`
                  : `Hi ${GREETING_NAME}.`}
              </p>
              <p className="mt-1 text-lg text-foreground/80">
                How are you doing today?
              </p>
              <div className="mt-5 grid gap-2.5">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pickMood(m)}
                    className="rounded-2xl border border-border/70 bg-background/50 px-4 py-3 text-left text-base transition hover:border-primary hover:bg-primary/8"
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "askMore" && (
            <div>
              <p className="font-display text-xl font-semibold tracking-tight">
                Do you want to tell me anything?
              </p>
              <div className="mt-5 flex gap-3">
                <Button
                  className="flex-1"
                  disabled={busy}
                  onClick={() => setStep("write")}
                >
                  Yes
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => send(null)}
                >
                  {busy ? <Loader2 className="animate-spin" /> : "No"}
                </Button>
              </div>
            </div>
          )}

          {step === "write" && (
            <div>
              <p className="font-display text-lg font-semibold tracking-tight">
                I&apos;m listening.
              </p>
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="Whatever's on your mind…"
                className="mt-3 w-full resize-y rounded-2xl border border-border bg-background/60 px-4 py-3 text-base leading-relaxed outline-none focus:border-primary"
              />
              <div className="mt-4 flex justify-end gap-3">
                <Button
                  disabled={busy || text.trim().length === 0}
                  onClick={() => send(text.trim())}
                >
                  {busy ? <Loader2 className="animate-spin" /> : "Send"}
                </Button>
              </div>
            </div>
          )}

          {step === "thanks" && (
            <div>
              <p className="text-base leading-relaxed">
                Thank you for letting me know. I will get back to you asap!
              </p>
              <div className="mt-6 flex justify-end">
                <Button onClick={close}>Close</Button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
