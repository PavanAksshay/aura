# Regulatory brief — for a lawyer, not a substitute for one

**I am not a lawyer and this is not legal advice.** This document exists so
that a qualified Indian lawyer can answer the real questions in one paid hour
instead of three, by giving them the technical facts up front. Every factual
claim below is verifiable in this repository; file references are included so
your lawyer can check rather than take my word for it.

Prepared 2026-07-19, for Aura (`PavanAksshay/aura`), operated from Tamil Nadu.

---

## 1. What the product actually does

A psychologist records a therapy session in the browser. The audio is uploaded
to a backend the clinician runs themselves, transcribed locally, structured into
a note by a local language model, and stored in the clinician's own Supabase
project. No audio, transcript, or note is sent to any third-party AI service.

**Verifiable facts:**

| Claim | Where to check |
|---|---|
| Audio is deleted after transcription, including on failure | `backend/app/services/retention.py` — `finally` block |
| Audio never reaches the database | same file; only the transcript is written |
| Transcripts ARE retained indefinitely | migration `0007`, deliberate product decision |
| Transcription runs locally (Whisper) | `backend/app/services/transcription.py` |
| Note generation runs locally (Ollama) | `note.py`, `summary.py`, `memory_answer.py` — all post to `settings.ollama_url` |
| Data is stored per-clinician with row-level security | `supabase/migrations/*` RLS policies |
| Measured transcription accuracy | `backend/scripts/accuracy/` — 10.2% WER on hard audio |

## 2. The facts that create legal exposure

These are stated plainly because a lawyer cannot advise well on a sanitised
description.

**a. The notes are machine-generated and measurably imperfect.** On a
deliberately difficult recording the system produced a 10.2% word error rate.
More importantly, in one passage Whisper generated fluent text that was never
spoken, and in another it inverted the clinical meaning of what the patient
said ("the breathing helped a little" → "breathing won't help"). See
`backend/scripts/accuracy/README.md`.

**b. Notes enter the record without human review.** Transcription
automatically generates the note, marks the session exported, and indexes it
into the searchable patient memory. Migration `0017` adds an attestation so an
unreviewed note is visibly labelled as an unverified draft, but nothing
*prevents* an unreviewed note from being used.

**c. Patient data is processed without the patient being a user.** The patient
never signs up, never sees the app, and never accepts any terms. Their voice,
health information, and identity are processed on the clinician's authority
alone. The Terms place consent responsibility on the clinician
(`frontend/app/terms/page.tsx`).

**d. There is no verification that a user is a real clinician.** Anyone can
sign up and record.

**e. Special category data.** Mental-health information is sensitive personal
data under essentially every privacy regime.

**f. The operator has no formal legal entity.** Currently an individual in
Tamil Nadu. Contact: pavanaksshay07@gmail.com.

## 3. Questions for the lawyer

**Data protection (DPDP Act, 2023)**
1. When a clinician self-hosts the backend and owns the Supabase project, is
   the operator a Data Fiduciary, a Data Processor, or neither? Does shipping
   the software but not operating it change this?
2. Does mental-health data attract heightened obligations here?
3. What consent must the *patient* give, who must obtain it, and must it be
   recorded in the system rather than assumed?
4. Do the transcript-retention defaults need a stated retention period or
   deletion right to be lawful?

**Medical device / clinical software**
5. Does software that drafts clinical documentation fall within CDSCO's
   Medical Device Rules, 2017, as Software as a Medical Device? Does the
   distinction between *documenting* a session and *interpreting* it matter?
6. Does the fact that the note is AI-generated and known to contain errors
   change the classification or create a duty to warn?

**Professional and telemedicine rules**
7. Do the Telemedicine Practice Guidelines or RCI/professional-body rules
   impose requirements on AI-assisted record-keeping for psychologists?
8. Is there any obligation to verify practitioner registration before
   providing this kind of tool?

**Liability**
9. If a fabricated line in a note contributes to a clinical decision, where
   does liability sit between the clinician and the operator? Do the current
   Terms meaningfully limit this, and is such a limitation enforceable in India?
10. What is the minimum viable structure — sole proprietorship, LLP, private
    limited — before onboarding a single external user?

**If the answer is "you need more than one hour"**, question 5 is the one to
prioritise: medical-device classification determines whether this is a software
project or a regulated product, and everything else follows from it.

## 4. What has already been done

- Privacy Policy and Terms of Use exist, naming Tamil Nadu jurisdiction and
  the DPDP Act, and placing consent duties on the clinician.
- No HIPAA, SOC 2, ISO, or "certified" claim appears anywhere. HIPAA is
  mentioned only as an obligation the clinician may have. **Keep it that way** —
  no BAA can be offered.
- Public marketing claims were audited against the code on 2026-07-19; one
  false claim ("1 artifact persists: your note" — the transcript persists too)
  was corrected.
- Unreviewed notes are labelled as unverified AI drafts, and the count is
  surfaced on the dashboard.

## 5. What to stop doing until you have answers

- Do not onboard clinicians other than yourself.
- Do not describe Aura as compliant with anything.
- Do not remove the unreviewed-draft warning.
