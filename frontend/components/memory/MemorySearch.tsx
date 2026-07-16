"use client";

/**
 * Patient Memory as persistent chat. The left rail lists stored chats grouped
 * by patient (like an assistant's "Recents"); the main pane is the active
 * thread. Chats and messages live in Supabase under RLS (migration 0015), so
 * nothing is lost on tab switch or sign-out — the clinician deletes chats
 * explicitly. Follow-up questions send the recent turns to /memory/ask so
 * "which of those helped?" resolves against the running conversation.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Loader2,
  MessageSquarePlus,
  Plus,
  SendHorizonal,
  Sparkles,
  Trash2,
} from "lucide-react";

import { askMemory } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import type { MemoryChat, MemoryMessage, Patient } from "@/lib/types";
import { cn } from "@/lib/utils";
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
import { EASE_OUT } from "@/components/motion/primitives";

type PatientOption = Pick<Patient, "id" | "full_name">;

const EXAMPLES = [
  "What is the patient's biggest fear?",
  "What coping strategies have we already tried?",
  "How has sleep changed over recent sessions?",
];

/** Local-only message shape while a turn is in flight. */
type LocalMessage = Pick<
  MemoryMessage,
  "id" | "role" | "content" | "engine" | "matches"
>;

export function MemorySearch({
  userId,
  patients,
  initialChats,
}: {
  userId: string;
  patients: PatientOption[];
  initialChats: MemoryChat[];
}) {
  const supabase = createClient();

  const [chats, setChats] = useState<MemoryChat[]>(initialChats);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  // Patient category for a chat that hasn't been created yet ("all" = general).
  const [draftPatient, setDraftPatient] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = chats.find((c) => c.id === activeId) ?? null;
  const patientName = (id: string | null) =>
    patients.find((p) => p.id === id)?.full_name ?? null;

  // Keep the thread pinned to its latest turn.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function openChat(chat: MemoryChat) {
    setActiveId(chat.id);
    setConfirmDelete(null);
    setLoadingThread(true);
    const { data, error } = await supabase
      .from("memory_messages")
      .select("*")
      .eq("chat_id", chat.id)
      .order("created_at", { ascending: true })
      .returns<MemoryMessage[]>();
    setLoadingThread(false);
    if (error) {
      toast.error("Could not load chat", error.message);
      return;
    }
    setMessages(data ?? []);
  }

  function newChat(patientId?: string | null) {
    setActiveId(null);
    setMessages([]);
    setConfirmDelete(null);
    if (patientId !== undefined) setDraftPatient(patientId ?? "all");
    inputRef.current?.focus();
  }

  async function deleteChat(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    const { error } = await supabase.from("memory_chats").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete chat", error.message);
      return;
    }
    setChats((prev) => prev.filter((c) => c.id !== id));
    setConfirmDelete(null);
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    toast.success("Chat deleted");
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setQuery("");

    try {
      // 1. Ensure the chat row exists (first question names the chat).
      let chat = active;
      if (!chat) {
        const patient_id = draftPatient === "all" ? null : draftPatient;
        const { data, error } = await supabase
          .from("memory_chats")
          .insert({ user_id: userId, patient_id, title: q.slice(0, 60) })
          .select()
          .single<MemoryChat>();
        if (error) throw new Error(`${error.message} — has migration 0015 been applied?`);
        chat = data;
        setChats((prev) => [data, ...prev]);
        setActiveId(data.id);
      }

      // 2. Optimistic user turn, then ask with the running conversation.
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, role: "user", content: q, engine: null, matches: null },
      ]);

      const res = await askMemory({
        query: q,
        patientId: chat.patient_id,
        history,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `local-a-${Date.now()}`,
          role: "assistant",
          content: res.answer,
          engine: res.engine,
          matches: res.matches,
        },
      ]);

      // 3. Persist both turns + bump the chat.
      const now = new Date().toISOString();
      const { error: msgErr } = await supabase.from("memory_messages").insert([
        { chat_id: chat.id, user_id: userId, role: "user", content: q },
        {
          chat_id: chat.id,
          user_id: userId,
          role: "assistant",
          content: res.answer,
          engine: res.engine,
          matches: res.matches,
        },
      ]);
      if (msgErr) {
        toast.error("Answer shown but not saved", msgErr.message);
      } else {
        await supabase
          .from("memory_chats")
          .update({ updated_at: now })
          .eq("id", chat.id);
        setChats((prev) => {
          const bumped = prev.find((c) => c.id === chat.id);
          if (!bumped) return prev;
          return [
            { ...bumped, updated_at: now },
            ...prev.filter((c) => c.id !== chat.id),
          ];
        });
      }
    } catch (err) {
      toast.error(
        "Could not get an answer",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void send(query);
  }

  // Sidebar grouping: patient categories first (roster order), General last.
  const groups: { key: string; label: string; patientId: string | null; items: MemoryChat[] }[] =
    [
      ...patients.map((p) => ({
        key: p.id,
        label: p.full_name,
        patientId: p.id as string | null,
        items: chats.filter((c) => c.patient_id === p.id),
      })),
      {
        key: "general",
        label: "All patients",
        patientId: null,
        items: chats.filter(
          (c) => !c.patient_id || !patients.some((p) => p.id === c.patient_id),
        ),
      },
    ].filter((g) => g.items.length > 0 || g.key === "general");

  const activePatientLabel = active
    ? (patientName(active.patient_id) ?? "All patients")
    : draftPatient === "all"
      ? null
      : (patientName(draftPatient) ?? null);

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
      {/* ------------------------------------------------ sidebar: chats */}
      <aside className="glass flex max-h-[38rem] flex-col rounded-3xl p-3 lg:sticky lg:top-24">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => newChat()}
          className="w-full justify-start"
        >
          <MessageSquarePlus />
          New chat
        </Button>

        <div className="mt-3 flex-1 space-y-4 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="flex items-center justify-between px-2">
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </p>
                <button
                  type="button"
                  aria-label={`New chat about ${g.label}`}
                  onClick={() => newChat(g.patientId)}
                  className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              {g.items.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground/60">
                  No chats yet
                </p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {g.items.map((c) => (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => void openChat(c)}
                        className={cn(
                          "w-full cursor-pointer truncate rounded-xl px-3 py-2 pr-9 text-left text-sm transition-colors",
                          c.id === activeId
                            ? "bg-primary/12 font-medium text-foreground"
                            : "text-muted-foreground hover:bg-foreground/6 hover:text-foreground",
                        )}
                      >
                        {c.title}
                      </button>
                      <button
                        type="button"
                        aria-label={
                          confirmDelete === c.id ? "Confirm delete" : `Delete “${c.title}”`
                        }
                        onClick={() => void deleteChat(c.id)}
                        className={cn(
                          "absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1.5 transition-all",
                          confirmDelete === c.id
                            ? "bg-destructive/15 text-destructive"
                            : "text-muted-foreground opacity-0 hover:bg-foreground/8 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100",
                        )}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* ------------------------------------------------ main: thread */}
      <section className="glass flex h-[min(38rem,calc(100vh-16rem))] min-h-[24rem] flex-col rounded-3xl">
        {/* Thread header */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <p className="truncate font-display text-sm font-semibold">
            {active ? active.title : "New chat"}
          </p>
          {activePatientLabel && <Badge tone="accent">{activePatientLabel}</Badge>}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {loadingThread ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading chat…
            </div>
          ) : messages.length === 0 && !busy ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/12 text-accent">
                <BrainCircuit className="size-7" />
              </div>
              <h2 className="mt-5 font-display text-lg font-semibold">
                Ask your practice a question
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                Pick a patient below (or ask across everyone) — the conversation
                is saved until you delete it. Try:
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => void send(example)}
                    className="glass-subtle cursor-pointer rounded-full px-4 py-2 text-sm text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  {m.role === "user" ? (
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/12 px-4 py-2.5 text-sm leading-relaxed">
                      {m.content}
                    </p>
                  ) : (
                    <div className="max-w-[90%]">
                      <div className="glass-subtle rounded-2xl rounded-bl-md p-4">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                          <Sparkles className="size-3.5" />
                          Answer
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                          {m.content}
                        </p>
                        {m.engine && m.engine !== "ollama" && (
                          <p className="mt-2 text-xs text-muted-foreground/70">
                            Local model offline — showing the closest note instead.
                          </p>
                        )}
                      </div>
                      {m.matches && m.matches.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-2 pl-1">
                          {m.matches.slice(0, 3).map((match) => (
                            <Link
                              key={`${m.id}-${match.session_id}-${match.chunk_index}`}
                              href={`/sessions/${match.session_id}`}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                            >
                              {Math.round(match.similarity * 100)}% · open note
                              <ArrowRight className="size-3" />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
              {busy && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="glass-subtle flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Recalling from your notes…
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2.5 border-t border-border p-4 sm:flex-row"
        >
          {active ? (
            // A chat's patient category is fixed at creation.
            <div className="flex h-11 shrink-0 items-center rounded-xl border border-border bg-input px-4 text-sm text-muted-foreground sm:w-44">
              <span className="truncate">
                {patientName(active.patient_id) ?? "All patients"}
              </span>
            </div>
          ) : (
            <Select value={draftPatient} onValueChange={setDraftPatient}>
              <SelectTrigger
                aria-label="Patient for this chat"
                className="w-full sm:w-44"
              >
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
          <div className="flex flex-1 gap-2.5">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={active ? "Ask a follow-up…" : "Ask your notes anything…"}
              aria-label="Memory question"
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={busy || !query.trim()} aria-label="Send">
              {busy ? <Loader2 className="animate-spin" /> : <SendHorizonal />}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
