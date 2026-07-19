"""Data lifecycle.

Guarantees enforced here so they are auditable:

1. Raw patient audio exists ONLY as a scratch file during inference.
   `run_transcription_pipeline` deletes it in a `finally` block — success,
   failure, or crash-adjacent, the file does not survive the job.

2. The transcript is retained after export (migration 0007); `export_session_row`
   marks the session exported without destroying it. Audio remains ephemeral.
"""

import logging
from pathlib import Path
from typing import cast

from app.db.supabase import get_service_client
from app.models.schemas import SessionStatus

logger = logging.getLogger(__name__)


def delete_audio_file(path: Path) -> None:
    """Remove a scratch audio file; missing is fine (never raise here)."""
    try:
        path.unlink(missing_ok=True)
    except OSError:
        # Log loudly: a lingering audio file is a retention-policy violation.
        logger.exception("Failed to delete scratch audio %s — manual purge required", path)


def run_transcription_pipeline(
    session_id: str,
    user_id: str,
    audio_path: Path,
    patient_id: str | None = None,
) -> None:
    """Background job: Whisper → SOAP → summary → auto-export. Audio is purged
    no matter what.

    The note is finalized automatically: as soon as transcription completes we
    also generate the structured summary, mark the session exported, and index
    the note into patient memory — so every session is immediately searchable in
    Memory without the clinician clicking "export". (The transcript is retained,
    migration 0007; only the audio is ephemeral.)

    All DB writes are scoped by BOTH session id and user id (belt and suspenders
    on top of the ownership check the route already performed).
    """
    from app.services.embeddings import index_exported_note
    from app.services.note import build_session_note
    from app.services.summary import generate_summary
    from app.services.transcription import transcribe_audio

    db = get_service_client()
    try:
        transcript = transcribe_audio(audio_path)
        note = build_session_note(transcript)
        summary = generate_summary(transcript)

        db.table("sessions").update(
            {
                "status": SessionStatus.EXPORTED.value,
                "raw_transcript": transcript,
                "note": note.model_dump(),
                "summary": summary.model_dump(),
                "exported_at": "now()",
            }
        ).eq("id", session_id).eq("user_id", user_id).execute()

        # Auto-index into patient memory (non-fatal — see index_exported_note).
        index_exported_note(session_id, user_id, patient_id, note)
    except Exception:
        logger.exception("Transcription pipeline failed for session %s", session_id)
        db.table("sessions").update(
            {
                "status": SessionStatus.FAILED.value,
                # Generic detail only — never leak transcript fragments or
                # model internals into a user-visible field.
                "error_detail": "Transcription failed. The audio was not retained.",
            }
        ).eq("id", session_id).eq("user_id", user_id).execute()
    finally:
        delete_audio_file(audio_path)


def export_session_row(session_id: str, user_id: str) -> dict[str, object] | None:
    """Mark a ready session exported and stamp exported_at atomically.

    As of migration 0007 the raw transcript is RETAINED (product decision) so
    it can be reviewed, downloaded, and summarized later — only the audio is
    ephemeral. Returns the updated row, or None if no owned, ready session
    matched; the update's WHERE clause is the authorization check.
    """
    db = get_service_client()
    result = (
        db.table("sessions")
        .update(
            {
                "status": SessionStatus.EXPORTED.value,
                "exported_at": "now()",
            }
        )
        .eq("id", session_id)
        .eq("user_id", user_id)
        .eq("status", SessionStatus.READY.value)
        .execute()
    )
    rows = cast(list[dict[str, object]], result.data or [])
    return rows[0] if rows else None


def mark_session_reviewed(session_id: str, user_id: str) -> dict[str, object] | None:
    """Record that this clinician read the generated note and stands behind it.

    Notes are drafted by a local 3B model and auto-indexed into Memory with no
    human in the loop, so until this is set the note is an unverified machine
    draft (migration 0017). Scoped by owner; the WHERE clause is the
    authorization check. Idempotent by intent — re-attesting refreshes the
    timestamp rather than erroring.
    """
    db = get_service_client()
    result = (
        db.table("sessions")
        .update({"reviewed_at": "now()", "reviewed_by": user_id})
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    rows = cast(list[dict[str, object]], result.data or [])
    return rows[0] if rows else None
