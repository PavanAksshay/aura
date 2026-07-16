"use client";

/**
 * Patient Memory: ask a question and get a concise, *specific* answer synthesized
 * from your own exported notes (local LLM over semantic matches) — not a dump of
 * every SOAP section. The left rail keeps this session's Q&A as a timeline; it
 * lives in component state, so it clears the moment you leave the tab.
 */

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Loader2,
  MessagesSquare,
  Search,
  Sparkles,
} from "lucide-react";

import { askMemory } from "@/lib/api";
import type { MemoryMatch, Patient } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { EASE_OUT } from "@/components/motion/primitives";

type PatientOption = Pick<Patient, "id" | "full_name">;

interface QAEntry {
  id: string;
  question: string;
  patientLabel: string;
  answer: string;
  engine: string;
  matches: MemoryMatch[];
  createdAt: number;
}

const EXAMPLES = [
  "What is the patient's biggest fear?",
  "What coping strategies have we already tried?",
  "How has sleep changed over recent sessions?",
];

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MemorySearch({ patients }: { patients: PatientOption[] }) {
  const [query, setQuery] = useState("");
  const [patientId, setPatientId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QAEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = history.find((h) => h.id === activeId) ?? null;
  const patientName = (id: string | null) =>
    patients.find((p) => p.id === id)?.full_name ?? null;

  async function run(q: string) {
    const trimmed = q.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const pid = patientId || null;
    const label = pid ? (patientName(pid) ?? "Patient") : "All patients";
    try {
      const res = await askMemory({ query: trimmed, patientId: pid });
      const entry: QAEntry = {
        id: crypto.randomUUID(),
        question: trimmed,
        patientLabel: label,
        answer: res.answer,
        engine: res.engine,
        matches: res.matches,
        createdAt: Date.now(),
      };
      setHistory((h) => [entry, ...h]);
      setActiveId(entry.id);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void run(query);
  }

  const timelineItems: TimelineItem[] = history.map((h) => ({
    id: h.id,
    label: formatTime(h.createdAt),
    title: h.question,
    description: h.answer,
    active: h.id === activeId,
    onSelect: () => setActiveId(h.id),
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
      {/* Left rail — this session's Q&A timeline */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-3 flex items-center gap-2">
          <MessagesSquare className="size-4 text-primary" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            This session
          </h2>
        </div>
        {history.length === 0 ? (
          <p className="glass-subtle rounded-2xl p-4 text-xs leading-relaxed text-muted-foreground">
            The questions you ask appear here as a timeline — and clear the moment
            you leave this tab.
          </p>
        ) : (
          <Timeline items={timelineItems} />
        )}
      </aside>

      {/* Main — ask + specific answer */}
      <div>
        <form onSubmit={handleSubmit} className="glass rounded-3xl p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask your notes anything…"
                className="pl-11"
                aria-label="Memory query"
              />
            </div>
            {patients.length > 0 && (
              <Select
                value={patientId || "all"}
                onValueChange={(v) => setPatientId(v === "all" ? "" : v)}
              >
                <SelectTrigger aria-label="Filter by patient" className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All patients</SelectItem>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button type="submit" disabled={busy || !query.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
              Ask
            </Button>
          </div>
        </form>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6">
          <AnimatePresence mode="wait">
            {busy && !active ? (
              <motion.div
                key="busy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
              >
                <Loader2 className="size-4 animate-spin" />
                Recalling from your notes…
              </motion.div>
            ) : active ? (
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
              >
                {/* The specific answer */}
                <div className="glass rounded-3xl p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                      <Sparkles className="size-4" />
                      Answer
                    </span>
                    <Badge tone="muted">{active.patientLabel}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {active.question}
                  </p>
                  <p className="mt-3 text-base leading-relaxed text-foreground">
                    {active.answer}
                  </p>
                  {active.engine !== "ollama" && (
                    <p className="mt-3 text-xs text-muted-foreground/70">
                      Local model offline — showing the closest note instead of a
                      synthesized answer.
                    </p>
                  )}
                </div>

                {/* Supporting excerpts (noise-filtered) */}
                {active.matches.length > 0 && (
                  <div className="mt-5">
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Supporting excerpts
                    </h3>
                    <ol className="space-y-2">
                      {active.matches.map((m) => (
                        <li
                          key={`${m.session_id}-${m.chunk_index}`}
                          className="glass-subtle rounded-2xl p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <Badge tone="accent">
                              {Math.round(m.similarity * 100)}% match
                            </Badge>
                            {patientName(m.patient_id) && (
                              <span className="text-xs text-muted-foreground">
                                {patientName(m.patient_id)}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground/85">
                            {m.content}
                          </p>
                          <Link
                            href={`/sessions/${m.session_id}`}
                            className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                          >
                            Open the full note
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-6 text-center"
              >
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent/12 text-accent">
                  <BrainCircuit className="size-7" />
                </div>
                <h2 className="mt-5 font-display text-lg font-semibold">
                  Ask your practice a question
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                  Every session note is indexed into a private, on-device memory.
                  Ask in plain language and get a specific answer. Try:
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setQuery(example);
                        void run(example);
                      }}
                      className="glass-subtle cursor-pointer rounded-full px-4 py-2 text-sm text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:text-foreground"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
