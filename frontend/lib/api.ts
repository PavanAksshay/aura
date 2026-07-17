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

async function parseError(res: Response): Promise<never> {
  let detail = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { detail?: string };
    if (body.detail) detail = body.detail;
  } catch {
    // non-JSON error body — keep the generic message
  }
  throw new Error(detail);
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

  const res = await fetch(`${API_URL}/api/v1/transcriptions`, {
    method: "POST",
    headers: await authHeader(),
    body: form,
  });
  if (!res.ok) return parseError(res);
  return (await res.json()) as { session_id: string };
}

/** Generate + persist a structured summary of a session's transcript. */
export async function summarizeSession(
  sessionId: string,
): Promise<SessionSummary> {
  const res = await fetch(
    `${API_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/summarize`,
    { method: "POST", headers: await authHeader() },
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
  const res = await fetch(`${API_URL}/api/v1/memory/search`, {
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
  const res = await fetch(`${API_URL}/api/v1/memory/ask`, {
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
 * Export the structured note. Server-side this is the point of no return:
 * the raw transcript is purged and only the SOAP note survives.
 */
export async function exportSession(sessionId: string): Promise<ClinicalSession> {
  const res = await fetch(
    `${API_URL}/api/v1/sessions/${encodeURIComponent(sessionId)}/export`,
    { method: "POST", headers: await authHeader() },
  );
  if (!res.ok) return parseError(res);
  return (await res.json()) as ClinicalSession;
}
