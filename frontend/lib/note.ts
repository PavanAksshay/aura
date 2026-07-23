/**
 * Reading the generated session note.
 *
 * The note is two sections of bullets — "What was discussed" and "What lies
 * ahead" (migration 0016). Sessions created before that hold the legacy SOAP
 * shape, so every surface reads notes through `normalizeNote`, which folds
 * subjective/objective/assessment → discussed and plan → ahead, and drops the
 * old "No … identified." placeholders.
 */

import type { LegacySoapNote, SessionNote } from "@/lib/types";

export const NOTE_SECTIONS = [
  { key: "discussed", label: "What was discussed" },
  { key: "ahead", label: "What lies ahead" },
] as const;

/** The two section keys, derived from NOTE_SECTIONS so they cannot drift. */
export type NoteSectionKey = (typeof NOTE_SECTIONS)[number]["key"];

const PLACEHOLDER = /^no\b.*\bidentified\.?$/i;

function bullets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = String(item).trim().replace(/^[-•–]\s*/, "");
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

/** Read a stored note in either shape into the two-section form. */
export function normalizeNote(
  raw: SessionNote | LegacySoapNote | null | undefined,
): SessionNote {
  if (!raw) return { discussed: [], ahead: [] };

  if ("discussed" in raw || "ahead" in raw) {
    const n = raw as Partial<SessionNote>;
    return { discussed: bullets(n.discussed), ahead: bullets(n.ahead) };
  }

  const legacy = raw as Partial<LegacySoapNote>;
  const keep = (v: string | undefined): string | null => {
    const text = (v ?? "").trim();
    return text && !PLACEHOLDER.test(text) ? text : null;
  };
  const discussed = [legacy.subjective, legacy.objective, legacy.assessment]
    .map(keep)
    .filter((t): t is string => t !== null);
  const plan = keep(legacy.plan);
  return { discussed, ahead: plan ? [plan] : [] };
}

/** True when there's anything worth rendering. */
export function noteHasContent(note: SessionNote): boolean {
  return note.discussed.length > 0 || note.ahead.length > 0;
}

// High-frequency function words that are distinctive to romanized Tamil and
// Hindi ("Tanglish"/"Hinglish") and rare in English. A therapy transcript that
// leans on several of these is code-mixed even though it is written in the
// Latin alphabet — which the script test below cannot see. Kept deliberately to
// distinctive, multi-letter words so ordinary English does not trip it.
const ROMANIZED_MARKERS = new Set([
  // Tamil
  "panren", "panni", "pannunga", "pannalaam", "pannama", "panradha",
  "pannuvom", "irukku", "irukka", "irukkalam", "irundhu", "irundha",
  "irukken", "varudhu", "aagudhu", "aachu", "aana", "aagiduven", "enna",
  "eppo", "eppadi", "ippo", "romba", "konjam", "kooda", "sila", "adhigama",
  "seri", "puriyudhu", "dhaan", "naan", "neenga", "unga", "adha", "adhu",
  "indha", "adhukku", "maadhiri", "perusa", "chinna", "illa", "vandhu",
  "pesalaam", "sonnaru",
  // Hindi
  "hai", "nahi", "nahin", "kya", "mera", "meri", "bahut", "raha", "rahi",
  "hoon", "mujhe", "karta", "karti", "tha", "thi", "hota", "hoti",
]);

/**
 * Roughly, was this session spoken in a non-English language (Tamil, Hindi, …)?
 *
 * Two ways in. Whisper usually writes the transcript in the spoken language's
 * own script, so a Tamil/Hindi session carries non-Latin letters — that's the
 * script test. But when the speech is heavily code-switched (or later
 * romanized) it can come back in the Latin alphabet, e.g. "konjam stress-a
 * feel panren" — all Latin, yet not English. The marker test catches that.
 *
 * The summary is always written in English, so on either kind of session the
 * note is a translation and the UI asks the clinician for extra scrutiny. This
 * drives that banner. (The backend's grounding guard keys on script alone: for
 * romanized text its lexical check still has real English words to work with,
 * so it stays on there — this function is intentionally broader than that.)
 */
export function isNonEnglishTranscript(transcript: string): boolean {
  let letters = 0;
  let foreign = 0;
  for (const ch of transcript) {
    if (!/\p{L}/u.test(ch)) continue;
    letters += 1;
    // Latin (incl. accented — José, café) ends at U+024F; Tamil, Devanagari,
    // and other scripts sit above it.
    if (ch.codePointAt(0)! > 0x024f) foreign += 1;
  }
  if (letters > 0 && foreign / letters >= 0.15) return true;

  // Romanized code-mixing: several distinctive Tamil/Hindi markers in Latin.
  const words = transcript.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.length === 0) return false;
  const hits = words.filter((w) => ROMANIZED_MARKERS.has(w)).length;
  return hits / words.length >= 0.05;
}

/** Plain-text rendering (clipboard, PDF fallback). */
export function noteToText(note: SessionNote): string {
  return NOTE_SECTIONS.map(({ key, label }) => {
    const items = note[key];
    const body = items.length ? items.map((b) => `• ${b}`).join("\n") : "—";
    return `${label}:\n${body}`;
  }).join("\n\n");
}
