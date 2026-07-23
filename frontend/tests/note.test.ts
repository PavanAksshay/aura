/**
 * Note reading and rendering.
 *
 * `normalizeNote` is the single place every surface reads a note through, and
 * it has to keep understanding the legacy SOAP shape indefinitely — sessions
 * recorded before migration 0016 still exist and must still render. A silent
 * regression here blanks a clinical record in the UI while the data is fine.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  isNonEnglishTranscript,
  NOTE_SECTIONS,
  noteToText,
  normalizeNote,
} from "../lib/note.ts";

test("reads the current two-section shape", () => {
  const note = normalizeNote({
    discussed: ["Poor sleep, four hours a night"],
    ahead: ["Trial a wind-down routine"],
  });
  assert.deepEqual(note.discussed, ["Poor sleep, four hours a night"]);
  assert.deepEqual(note.ahead, ["Trial a wind-down routine"]);
});

test("folds a legacy SOAP note into the two sections", () => {
  const note = normalizeNote({
    subjective: "Reports low mood",
    objective: "Flat affect",
    assessment: "Consistent with depression",
    plan: "Weekly sessions",
  });
  assert.deepEqual(note.discussed, [
    "Reports low mood",
    "Flat affect",
    "Consistent with depression",
  ]);
  assert.deepEqual(note.ahead, ["Weekly sessions"]);
});

test("drops the old empty-SOAP placeholders", () => {
  // Pre-0016 rows are full of these; rendering them would put "No objective
  // findings identified." into a record as if it were a finding.
  const note = normalizeNote({
    subjective: "Reports low mood",
    objective: "No objective findings identified.",
    assessment: "No assessment identified",
    plan: "No plan identified.",
  });
  assert.deepEqual(note.discussed, ["Reports low mood"]);
  assert.deepEqual(note.ahead, []);
});

test("strips bullet markers and de-duplicates", () => {
  const note = normalizeNote({
    discussed: ["- Poor sleep", "• Poor sleep", "– Racing thoughts", "  "],
    ahead: [],
  });
  assert.deepEqual(note.discussed, ["Poor sleep", "Racing thoughts"]);
});

test("an empty or missing note is not a crash", () => {
  assert.deepEqual(normalizeNote(null), { discussed: [], ahead: [] });
  assert.deepEqual(normalizeNote(undefined), { discussed: [], ahead: [] });
  assert.deepEqual(normalizeNote({ discussed: [], ahead: [] }), {
    discussed: [],
    ahead: [],
  });
});

test("non-array bullet values are ignored rather than rendered", () => {
  // Hand-edited or partially-written rows should degrade, not throw.
  const note = normalizeNote({
    discussed: "not an array",
    ahead: null,
  } as unknown as Parameters<typeof normalizeNote>[0]);
  assert.deepEqual(note, { discussed: [], ahead: [] });
});

test("plain-text rendering keeps both sections, marking empty ones", () => {
  const text = noteToText({ discussed: ["Poor sleep"], ahead: [] });
  assert.match(text, /What was discussed:/);
  assert.match(text, /• Poor sleep/);
  assert.match(text, /What lies ahead:\n—/);
});

test("section keys and labels stay in sync", () => {
  assert.deepEqual(
    NOTE_SECTIONS.map((s) => s.key),
    ["discussed", "ahead"],
  );
});

// The session page uses this to flag a translated note for extra review, and
// it must agree with the backend's _is_multilingual — both gate the same
// safety behaviour on "is this session English?".
test("flags Tamil and Hindi transcripts as non-English", () => {
  assert.ok(isNonEnglishTranscript("எனக்கு தூக்கம் வரவில்லை. கவலையாக இருக்கிறேன்."));
  assert.ok(isNonEnglishTranscript("मुझे बहुत चिंता हो रही है और मैं सो नहीं पाता।"));
  // Code-switched (Hindi script + English) is still non-English.
  assert.ok(isNonEnglishTranscript("Mujhe बहुत तनाव हो रहा है because of work."));
});

test("leaves English transcripts — including accented names — alone", () => {
  assert.ok(
    !isNonEnglishTranscript(
      "The patient reported feeling anxious about work and poor sleep.",
    ),
  );
  assert.ok(!isNonEnglishTranscript("José and café owner Renée spoke at length."));
  assert.ok(!isNonEnglishTranscript(""));
});

// Romanized Tanglish/Hinglish is 100% Latin, so the script test misses it —
// the distinctive-marker test has to carry it, or the banner never shows.
test("flags romanized Tanglish/Hinglish even with no Tamil letters", () => {
  assert.ok(
    isNonEnglishTranscript(
      "Hi doctor, konjam stress-a feel panren. Recent-a romba overthink panren. " +
        "Naan enough illa nu feel aagudhu.",
    ),
  );
  assert.ok(
    isNonEnglishTranscript("Mujhe bahut tension hai aur mera neend nahi aa rahi hai."),
  );
});

test("a stray foreign loanword does not flag ordinary English", () => {
  // "kya" or a single borrowed word shouldn't cross the 5% marker threshold.
  assert.ok(
    !isNonEnglishTranscript(
      "We discussed her yoga practice and a mantra she repeats when anxious.",
    ),
  );
});
