/** Shared domain types — mirror backend/app/models/schemas.py. */

export type SessionStatus = "processing" | "ready" | "exported" | "failed";

/**
 * The generated session note: two readable sections of bullets (0016).
 * Replaced SOAP, whose four buckets a therapy dialogue rarely fit.
 */
export interface SessionNote {
  discussed: string[];
  ahead: string[];
}

/** The legacy SOAP shape — older rows still hold it; read via normalizeNote(). */
export interface LegacySoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

/** Structured, on-demand summary of a session transcript. */
export interface SessionSummary {
  patient_name: string;
  age: string;
  personal_details: string;
  discussion: string;
  engine: string;
}

export interface ClinicalSession {
  id: string;
  user_id: string;
  /** Optional roster link (0004); null for unattributed recordings. */
  patient_id: string | null;
  title: string;
  status: SessionStatus;
  audio_duration_seconds: number | null;
  /** Retained after export (migration 0007); only audio is ephemeral. */
  raw_transcript: string | null;
  /** Generated note (0016). May hold the legacy SOAP shape on older rows. */
  note: SessionNote | LegacySoapNote | null;
  /** Therapist's own free-text notes on the session (0014). */
  clinician_notes: string | null;
  summary: SessionSummary | null;
  error_detail: string | null;
  created_at: string;
  updated_at: string;
  exported_at: string | null;
  /** Clinician attestation (0017). null = note is an unverified AI draft. */
  reviewed_at: string | null;
  reviewed_by: string | null;
  /** When the clinician last hand-edited the note (0018); null = as drafted. */
  note_edited_at: string | null;
  /**
   * Session was transcribed in a non-English language, so the note is an
   * English translation (0020). Set by the pipeline from the original script,
   * before romanization. Older rows are false and fall back to text-detection.
   */
  source_non_english: boolean | null;
}

export type PatientStatus = "active" | "paused" | "discharged";

/** Roster entry (public.patients) — owner-only under RLS. */
export interface Patient {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string | null;
  pronouns: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  presenting_concerns: string | null;
  status: PatientStatus;
  created_at: string;
  updated_at: string;
}

export type AppointmentStatus = "scheduled" | "completed" | "cancelled";

/** Calendar entry (public.appointments) — owner-only under RLS. */
export interface Appointment {
  id: string;
  user_id: string;
  /** Optional roster link (0008); null if the patient was removed. */
  patient_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  notes: string | null;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
}

/** Stored file metadata (public.documents); bytes live in Storage (0009). */
export interface PatientDocument {
  id: string;
  user_id: string;
  patient_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

/** A semantic-memory hit from match_note_chunks(). */
export interface MemoryMatch {
  session_id: string;
  patient_id: string | null;
  chunk_index: number;
  content: string;
  similarity: number;
}

/** A synthesized answer to a memory question + its supporting excerpts. */
export interface MemoryAnswer {
  answer: string;
  engine: string;
  matches: MemoryMatch[];
}

/** A persistent Patient Memory chat thread (0015), grouped per patient. */
export interface MemoryChat {
  id: string;
  user_id: string;
  patient_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

/** One turn of a memory chat (0015). matches = the excerpts an answer cited. */
export interface MemoryMessage {
  id: string;
  chat_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  engine: string | null;
  matches: MemoryMatch[] | null;
  created_at: string;
}

/** Clinician profile (public.profiles). clinic_name doubles as practice name. */
export interface Profile {
  id: string;
  full_name: string | null;
  clinic_name: string | null;
  title: string | null;
  /** Clinician's own gender (0013); null = not shared. */
  gender: string | null;
  /** Clinician's own date of birth, "yyyy-mm-dd" (0013); null = not shared. */
  date_of_birth: string | null;
  practice_type: string | null;
  country: string | null;
  timezone: string | null;
  specializations: string[];
  years_experience: number | null;
  onboarded: boolean;
  /** Chosen inkblot avatar id (0010); null until picked at onboarding. */
  avatar_id: string | null;
  /** Custom profile photo path in the avatars bucket (0011); overrides inkblot. */
  avatar_url: string | null;
  current_streak: number;
  longest_streak: number;
  last_active_on: string | null;
  /** Badge ids already awarded — drives one-shot unlock toasts (0010). */
  earned_badges: string[];
  privacy_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}
