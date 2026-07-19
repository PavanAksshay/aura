"""Session export + summarization.

Export finalizes a note and indexes it into patient memory. Summarize is an
on-demand, local-LLM pass over the retained transcript. Both are server-owned
policy actions, scoped to the verified clinician.
"""

import logging
from typing import cast

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.core.quota import ai_quota
from app.core.ratelimit import rate_limit
from app.core.security import CurrentUser
from app.db.supabase import get_service_client
from app.models.schemas import NoteUpdate, SessionNote, SessionOut, SessionSummary
from app.services.embeddings import index_exported_note
from app.services.note import build_session_note, parse_note
from app.services.retention import export_session_row, mark_session_reviewed
from app.services.summary import generate_summary
from app.services.transcription import swap_speaker_roles

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/sessions/{session_id}/export",
    response_model=SessionOut,
    # Export embeds the note for memory search.
    dependencies=[Depends(rate_limit(30, 60))],
)
async def export_session(
    session_id: str, user: CurrentUser, background: BackgroundTasks
) -> SessionOut:
    """Finalize a note: mark exported, then index it into patient memory.

    The update is filtered by owner AND status='ready', so a wrong owner, an
    unknown id, and a not-yet-ready session are all indistinguishable 404s.
    The transcript is retained (migration 0007); only the structured note text
    is embedded for memory search.
    """
    row = export_session_row(session_id=session_id, user_id=user.id)
    if row is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail="No exportable session found.",
        )

    if row.get("note") is not None:
        note = parse_note(cast(dict[str, object], row["note"]))
        background.add_task(
            index_exported_note,
            session_id,
            user.id,
            cast(str | None, row.get("patient_id")),
            note,
        )

    return SessionOut.model_validate(row)


@router.post(
    "/sessions/{session_id}/review",
    response_model=SessionOut,
    dependencies=[Depends(rate_limit(60, 60))],
)
async def review_session(session_id: str, user: CurrentUser) -> SessionOut:
    """Attest that the clinician has read the generated note and it is accurate.

    Notes are machine-drafted and auto-indexed into Memory with no human in the
    loop, so this is the only signal separating a verified clinical record from
    an unchecked AI draft. Deliberately not a gate on export — export has
    already happened by this point — but the state is surfaced wherever the
    note is shown.
    """
    row = mark_session_reviewed(session_id=session_id, user_id=user.id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return SessionOut.model_validate(row)


def _load_owned_session(session_id: str, user_id: str, columns: str) -> dict[str, object]:
    """Fetch one session the caller owns, or 404. The filter is the authz check."""
    db = get_service_client()
    result = (
        db.table("sessions").select(columns).eq("id", session_id).eq("user_id", user_id).execute()
    )
    rows = cast(list[dict[str, object]], result.data or [])
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return rows[0]


def _save_note(
    session_id: str,
    user_id: str,
    note: SessionNote,
    patient_id: str | None,
    *,
    edited: bool,
) -> dict[str, object]:
    """Persist a note, reset its review state, and re-index it into Memory.

    Any change to the note invalidates a prior attestation — it was given for
    different words — so reviewed_at is cleared and the clinician re-confirms.
    Re-indexing matters just as much: the note is already searchable in Memory,
    and leaving the old vectors would make Memory answer from text that no
    longer exists in the record.
    """
    db = get_service_client()
    updated = (
        db.table("sessions")
        .update(
            {
                "note": note.model_dump(),
                "reviewed_at": None,
                "reviewed_by": None,
                "note_edited_at": "now()" if edited else None,
            }
        )
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    rows = cast(list[dict[str, object]], updated.data or [])
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session not found.")

    index_exported_note(session_id, user_id, patient_id, note)
    return rows[0]


@router.patch(
    "/sessions/{session_id}/note",
    response_model=SessionOut,
    dependencies=[Depends(rate_limit(60, 60))],
)
def edit_session_note(session_id: str, payload: NoteUpdate, user: CurrentUser) -> SessionOut:
    """Replace the generated note with the clinician's corrected version.

    This is the remedy when the draft is wrong. The pipeline is measurably
    fallible — it has fabricated text and inverted clinical meaning on hard
    audio — so attesting to a bad note or discarding the session were never
    acceptable as the only options.
    """
    row = _load_owned_session(session_id, user.id, "patient_id")
    note = SessionNote(discussed=payload.discussed, ahead=payload.ahead)
    saved = _save_note(
        session_id,
        user.id,
        note,
        cast(str | None, row.get("patient_id")),
        edited=True,
    )
    return SessionOut.model_validate(saved)


# `def` (not `async def`): redrafting runs the local LLM, which blocks.
@router.post(
    "/sessions/{session_id}/regenerate-note",
    response_model=SessionOut,
    # Runs the local LLM, so it counts against the daily AI allowance.
    dependencies=[Depends(rate_limit(10, 60)), Depends(ai_quota())],
)
def regenerate_session_note(session_id: str, user: CurrentUser) -> SessionOut:
    """Re-draft the note from the stored transcript, discarding the current one.

    Decoding is not deterministic, so a second pass genuinely can produce a
    better note — but it can equally reintroduce a different error, and it
    overwrites hand edits. The UI warns before calling this.
    """
    row = _load_owned_session(session_id, user.id, "raw_transcript, patient_id")
    transcript = row.get("raw_transcript")
    if not isinstance(transcript, str) or not transcript.strip():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="No transcript available to redraft from.",
        )

    note = build_session_note(transcript)
    saved = _save_note(
        session_id,
        user.id,
        note,
        cast(str | None, row.get("patient_id")),
        edited=False,
    )
    return SessionOut.model_validate(saved)


# `def` (not `async def`): redrafting runs the local LLM, which blocks.
@router.post(
    "/sessions/{session_id}/swap-speakers",
    response_model=SessionOut,
    # Runs the local LLM, so it counts against the daily AI allowance.
    dependencies=[Depends(rate_limit(20, 60)), Depends(ai_quota())],
)
def swap_session_speakers(session_id: str, user: CurrentUser) -> SessionOut:
    """Correct an inverted Therapist/Patient labelling, and redraft the note.

    Diarization separates voices but cannot know which is the clinician, so the
    pipeline guesses that whoever speaks first is the therapist. When that guess
    is wrong every line is attributed to the wrong person.

    Swapping the transcript alone would leave the note — which was written from
    the wrong attribution — quietly contradicting it, so the note is rebuilt
    from the corrected transcript. Any prior review attestation is cleared for
    the same reason: it was given for different content.
    """
    db = get_service_client()
    result = (
        db.table("sessions")
        .select("raw_transcript")
        .eq("id", session_id)
        .eq("user_id", user.id)
        .execute()
    )
    rows = cast(list[dict[str, object]], result.data or [])
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session not found.")

    transcript = rows[0].get("raw_transcript")
    if not isinstance(transcript, str) or not transcript.strip():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="No transcript available to relabel."
        )
    if "Therapist:" not in transcript and "Patient:" not in transcript:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="This transcript has no speaker labels to swap.",
        )

    swapped = swap_speaker_roles(transcript)
    note = build_session_note(swapped)
    updated = (
        db.table("sessions")
        .update(
            {
                "raw_transcript": swapped,
                "note": note.model_dump(),
                "reviewed_at": None,
                "reviewed_by": None,
            }
        )
        .eq("id", session_id)
        .eq("user_id", user.id)
        .execute()
    )
    changed = cast(list[dict[str, object]], updated.data or [])
    if not changed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return SessionOut.model_validate(changed[0])


# `def` (not `async def`): the Ollama call is blocking, so FastAPI runs this
# in its threadpool rather than stalling the event loop.
@router.post(
    "/sessions/{session_id}/summarize",
    response_model=SessionSummary,
    # Each call is a full local-LLM pass over the transcript, so it counts
    # against the daily AI allowance.
    dependencies=[Depends(rate_limit(20, 60)), Depends(ai_quota())],
)
def summarize_session(session_id: str, user: CurrentUser) -> SessionSummary:
    """Generate + persist a structured summary of a session's transcript."""
    db = get_service_client()
    result = (
        db.table("sessions")
        .select("raw_transcript")
        .eq("id", session_id)
        .eq("user_id", user.id)
        .execute()
    )
    rows = cast(list[dict[str, object]], result.data or [])
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session not found.")

    transcript = rows[0].get("raw_transcript")
    if not isinstance(transcript, str) or not transcript.strip():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="No transcript available to summarize."
        )

    summary = generate_summary(transcript)
    db.table("sessions").update({"summary": summary.model_dump()}).eq("id", session_id).eq(
        "user_id", user.id
    ).execute()
    return summary
