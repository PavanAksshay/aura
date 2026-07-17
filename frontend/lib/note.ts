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

/** Plain-text rendering (clipboard, PDF fallback). */
export function noteToText(note: SessionNote): string {
  return NOTE_SECTIONS.map(({ key, label }) => {
    const items = note[key];
    const body = items.length ? items.map((b) => `• ${b}`).join("\n") : "—";
    return `${label}:\n${body}`;
  }).join("\n\n");
}
