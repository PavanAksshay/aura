/**
 * Typed client for the FastAPI backend.
 *
 * Every call attaches the caller's Supabase access token as a Bearer header;
 * the backend verifies it and binds the request to that clinician. Audio is
 * streamed as multipart form data and is never persisted client-side.
 */

import { createClient } from "@/lib/supabase/client";
import type {
  ClinicalSession,
  MemoryAnswer,
  MemoryMatch,
  SessionSummary,
} from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createClient();
  let {
    data: { session },
  } = await supabase.auth.getSession();

  // Supabase access tokens live ~1 hour. getSession() can hand back a token
  // that's expired (or about to be) if the tab sat idle, and the backend then
  // rejects it as "invalid or expired". Proactively refresh when the token has
  // expired or is within 60s of doing so, so backend calls always carry a
  // fresh token.
  const now = Math.floor(Date.now() / 1000);
  if (!session || (session.expires_at ?? 0) <= now + 60) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      throw new Error("Your session has expired — please sign in again.");
    }
    session = data.session;
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    // Skip ngrok's free-tier browser interstitial, which otherwise returns an
    // HTML warning page instead of the JSON the app expects. Harmless on any
    // other backend (an ignored custom header).
    "ngrok-skip-browser-warning": "true",
  };
}

/**
 * The processing backend is unreachable — offline, restarting, or its tunnel
 * is down. Distinct from a request that failed on its own merits, because the
 * user's data is fine and the right advice is "try again shortly", not
 * "something went wrong".
 */
/** One wording for every unreachable-backend path, matching the banner. */
export const MAINTENANCE_MESSAGE =
  "Sorry for the inconvenience caused. App is down for maintenance. Please try again later";

export class BackendUnavailableError extends Error {
  constructor(message = MAINTENANCE_MESSAGE) {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

export function isBackendUnavailable(error: unknown): boolean {
  return error instanceof BackendUnavailableError;
}

/** Gateway statuses a tunnel or proxy returns when nothing is listening. */
const GATEWAY_DOWN = new Set([502, 503, 504]);

// Transcription is a long job (Whisper runs locally); everything else should
// answer quickly. Without a ceiling a dead tunnel leaves requests hanging
// forever and the UI stuck in a spinner with no way to recover.
const DEFAULT_TIMEOUT_MS = 30_000;
// Whisper large-v3 on CPU runs slower than real time; an hour-long session is
// a long wait, not a fault.
const TRANSCRIBE_TIMEOUT_MS = 20 * 60_000;
// Ollama generation on a laptop is slow but bounded.
const LLM_TIMEOUT_MS = 4 * 60_000;

async function parseError(res: Response): Promise<never> {
  if (GATEWAY_DOWN.has(res.status)) throw new BackendUnavailableError();

  let detail = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { detail?: string };
    if (body.detail) detail = body.detail;
  } catch {
    // non-JSON error body — keep the generic message
  }
  throw new Error(detail);
}

/**
 * fetch with a timeout, translating "cannot reach the backend at all" into
 * BackendUnavailableError. A bare fetch rejects with an opaque TypeError
 * ("Failed to fetch") for DNS failures, refused connections, CORS rejections
 * and offline devices alike — surfacing that verbatim tells a clinician
 * nothing and reads like data loss.
 */
async function request(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // AbortSignal.timeout() rejects with a DOMException named "TimeoutError";
    // some engines surface a plain "AbortError" instead.
    const name = (error as { name?: string })?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw new BackendUnavailableError();
    }
    if (error instanceof TypeError) throw new BackendUnavailableError();
    throw error;
  }
}

/** Liveness probe used by the maintenance banner. Never throws. */
export async function pingBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/health`, {
      // Health must reflect reality, not a cached 200 from minutes ago.
      cache: "no-store",
      headers: { "ngrok-skip-browser-warning": "true" },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Upload a recorded session; the backend transcribes and structures it. */
export async function submitRecording(
  audio: Blob,
  opts: { title: string; durationSeconds: number; patientId?: string | null },
): Promise<{ session_id: string }> {
  const form = new FormData();
  form.append("audio", audio, "session-audio.webm");
  form.append("title", opts.title);
  form.append("duration_seconds", String(Math.round(opts.durationSeconds)));
  if (opts.patientId) form.append("patient_id", opts.patientId);

  const res = await request(
    `${API_URL}/api/v1/transcriptions`,
    { method: "POST", headers: await authHeader(), body: form },
    // Whisper transcribes locally; a long session legitimately takes minutes.
    TRANSCRIBE_TIMEOUT_MS,
  );
  if (!res.ok) return parseError(res);
  return (await res.json()) as { session_id: string };
}

/** Generate + persist a structured summary of a session's transcript. */
export async function summarizeSession(
  sessionId: string,
): Promise<SessionSummary> {
  const res = await request(
    `${API_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/summarize`,
    { method: "POST", headers: await authHeader() },
    LLM_TIMEOUT_MS,
  );
  if (!res.ok) return parseError(res);
  return (await res.json()) as SessionSummary;
}

/** Semantic search over the caller's own exported notes (local embeddings). */
export async function searchMemory(opts: {
  query: string;
  patientId?: string | null;
  limit?: number;
}): Promise<MemoryMatch[]> {
  const res = await request(`${API_URL}/api/v1/memory/search`, {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({
      query: opts.query,
      patient_id: opts.patientId ?? null,
      limit: opts.limit ?? 8,
    }),
  });
  if (!res.ok) return parseError(res);
  return (await res.json()) as MemoryMatch[];
}

/** Ask a question and get a concise, specific answer synthesized from notes.
 * Pass the chat's recent turns as `history` so follow-ups resolve correctly. */
export async function askMemory(opts: {
  query: string;
  patientId?: string | null;
  limit?: number;
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<MemoryAnswer> {
  const res = await request(`${API_URL}/api/v1/memory/ask`, {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({
      query: opts.query,
      patient_id: opts.patientId ?? null,
      limit: opts.limit ?? 4,
      // Cap client-side too; the schema rejects >12 turns.
      history: (opts.history ?? []).slice(-8),
    }),
  });
  if (!res.ok) return parseError(res);
  return (await res.json()) as MemoryAnswer;
}

/**
 * Replace the generated note with the clinician's corrected version. This is
 * the remedy when the draft is wrong — the server re-indexes Memory and clears
 * any prior review attestation, since it was given for different words.
 */
export async function updateNote(
  sessionId: string,
  note: { discussed: string[]; ahead: string[] },
): Promise<ClinicalSession> {
  const res = await request(
    `${API_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/note`,
    {
      method: "PATCH",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify(note),
    },
  );
  if (!res.ok) return parseError(res);
  return (await res.json()) as ClinicalSession;
}

/**
 * Ask the model for a fresh draft from the same transcript. Discards the
 * current note, including hand edits, so the UI confirms first. Runs the local
 * LLM, hence the longer ceiling.
 */
export async function regenerateNote(sessionId: string): Promise<ClinicalSession> {
  const res = await request(
    `${API_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/regenerate-note`,
    { method: "POST", headers: await authHeader() },
    LLM_TIMEOUT_MS,
  );
  if (!res.ok) return parseError(res);
  return (await res.json()) as ClinicalSession;
}

/**
 * Fix an inverted Therapist/Patient labelling. The server also redrafts the
 * note from the corrected transcript, so this runs the local LLM and is slow.
 */
export async function swapSpeakers(sessionId: string): Promise<ClinicalSession> {
  const res = await request(
    `${API_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/swap-speakers`,
    { method: "POST", headers: await authHeader() },
    LLM_TIMEOUT_MS,
  );
  if (!res.ok) return parseError(res);
  return (await res.json()) as ClinicalSession;
}

/**
 * Attest that a clinician has read the generated note and it is accurate.
 * Until this is set the note is an unverified machine draft (migration 0017).
 */
export async function reviewSession(sessionId: string): Promise<ClinicalSession> {
  const res = await request(
    `${API_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/review`,
    { method: "POST", headers: await authHeader() },
  );
  if (!res.ok) return parseError(res);
  return (await res.json()) as ClinicalSession;
}

/**
 * Export the structured note: marks it exported and indexes it into Memory.
 * The raw transcript is RETAINED (migration 0007) — only the audio is
 * ephemeral, and that is already gone by this point.
 */
export async function exportSession(sessionId: string): Promise<ClinicalSession> {
  const res = await request(
    `${API_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/export`,
    { method: "POST", headers: await authHeader() },
  );
  if (!res.ok) return parseError(res);
  return (await res.json()) as ClinicalSession;
}

// --- Daily well-being check-in (single-user feature) ----------------------

export interface CheckinReply {
  id: string;
  reply: string;
  replied_at: string;
}

export interface CheckinState {
  /** Is this account the one shown the check-in? Decided server-side. */
  enabled: boolean;
  done_today: boolean;
  /** An operator reply she hasn't seen yet, if any. */
  pending_reply: CheckinReply | null;
}

export interface CheckinInboxItem {
  id: string;
  name: string | null;
  mood: string;
  message: string | null;
  owner_reply: string | null;
  owner_replied_at: string | null;
  created_at: string;
}

/** Whether to show today's check-in, plus any unseen reply. `localDate` is her
 * local calendar day (YYYY-MM-DD), so "once per day" follows her timezone. */
export async function getCheckinState(localDate: string): Promise<CheckinState> {
  const res = await request(
    `${API_URL}/api/v1/checkin/state?local_date=${encodeURIComponent(localDate)}`,
    { method: "GET", headers: await authHeader() },
  );
  if (!res.ok) return parseError(res);
  return (await res.json()) as CheckinState;
}

export async function submitCheckin(opts: {
  mood: string;
  message: string | null;
  localDate: string;
}): Promise<void> {
  const res = await request(`${API_URL}/api/v1/checkin`, {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({
      mood: opts.mood,
      message: opts.message,
      local_date: opts.localDate,
    }),
  });
  if (!res.ok) return parseError(res);
}

export async function markReplySeen(checkinId: string): Promise<void> {
  const res = await request(
    `${API_URL}/api/v1/checkin/${encodeURIComponent(checkinId)}/seen`,
    { method: "POST", headers: await authHeader() },
  );
  if (!res.ok) return parseError(res);
}

/** Operator-only: all check-in messages, newest first. */
export async function getCheckinInbox(): Promise<CheckinInboxItem[]> {
  const res = await request(`${API_URL}/api/v1/checkin/inbox`, {
    method: "GET",
    headers: await authHeader(),
  });
  if (!res.ok) return parseError(res);
  return ((await res.json()) as { items: CheckinInboxItem[] }).items;
}

/** Operator-only: reply to a check-in; pushes the reply back to her. */
export async function replyToCheckin(
  checkinId: string,
  reply: string,
): Promise<void> {
  const res = await request(
    `${API_URL}/api/v1/checkin/inbox/${encodeURIComponent(checkinId)}/reply`,
    {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    },
  );
  if (!res.ok) return parseError(res);
}
