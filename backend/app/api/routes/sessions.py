"""Session export + summarization.

Export finalizes a note and indexes it into patient memory. Summarize is an
on-demand, local-LLM pass over the retained transcript. Both are server-owned
policy actions, scoped to the verified clinician.
"""

import logging
from typing import cast

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.core.ratelimit import rate_limit
from app.core.security import CurrentUser
from app.db.supabase import get_service_client
from app.models.schemas import SessionOut, SessionSummary, SoapNote
from app.services.embeddings import index_exported_note
from app.services.retention import export_session_row
from app.services.summary import generate_summary

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

    if row.get("soap") is not None:
        note = SoapNote.model_validate(row["soap"])
        background.add_task(
            index_exported_note,
            session_id,
            user.id,
            cast(str | None, row.get("patient_id")),
            note,
        )

    return SessionOut.model_validate(row)


# `def` (not `async def`): the Ollama call is blocking, so FastAPI runs this
# in its threadpool rather than stalling the event loop.
@router.post(
    "/sessions/{session_id}/summarize",
    response_model=SessionSummary,
    # Each call is a full local-LLM pass over the transcript.
    dependencies=[Depends(rate_limit(20, 60))],
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
    db.table("sessions").update({"summary": summary.model_dump()}).eq(
        "id", session_id
    ).eq("user_id", user.id).execute()
    return summary
