"""Audio ingestion: multipart upload → scratch file → background pipeline.

The endpoint returns 202 immediately with the new session id; the frontend
polls the session row (under RLS) for the status transition. The uploaded
audio is written to the scratch dir with a random name and is deleted by the
pipeline's `finally` — see app.services.retention for the lifecycle contract.
"""

import logging
import uuid
from typing import Annotated, cast

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Form,
    HTTPException,
    UploadFile,
    status,
)

from app.core.config import get_settings
from app.core.ratelimit import rate_limit
from app.core.security import CurrentUser
from app.db.supabase import get_service_client
from app.models.schemas import SessionStatus, TranscriptionAccepted
from app.services.retention import delete_audio_file, run_transcription_pipeline

logger = logging.getLogger(__name__)
router = APIRouter()

_ALLOWED_CONTENT_TYPES = {
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
}

_CHUNK = 1024 * 1024  # stream uploads in 1 MiB chunks


@router.post(
    "/transcriptions",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=TranscriptionAccepted,
    # Each upload pins the CPU for minutes (Whisper large-v3 + diarization).
    dependencies=[Depends(rate_limit(10, 300))],
)
async def create_transcription(
    user: CurrentUser,
    background: BackgroundTasks,
    audio: UploadFile,
    title: Annotated[str, Form(max_length=200)] = "Untitled session",
    duration_seconds: Annotated[int, Form(ge=0, le=4 * 3600)] = 0,
    patient_id: Annotated[str | None, Form(max_length=36)] = None,
) -> TranscriptionAccepted:
    settings = get_settings()

    base_type = (audio.content_type or "").split(";")[0].strip().lower()
    if base_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported audio type: {base_type or 'unknown'}",
        )

    # Validate the optional patient link *before* touching disk. The format
    # check is cheap; ownership is verified against the DB further down.
    patient_uuid: str | None = None
    if patient_id:
        try:
            patient_uuid = str(uuid.UUID(patient_id))
        except ValueError as exc:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid patient id."
            ) from exc

    # Random server-side filename: never derive paths from client input.
    scratch_path = settings.audio_scratch_dir / f"{uuid.uuid4().hex}.audio"
    settings.audio_scratch_dir.mkdir(parents=True, exist_ok=True)

    written = 0
    try:
        with scratch_path.open("wb") as out:
            while chunk := await audio.read(_CHUNK):
                written += len(chunk)
                if written > settings.max_audio_bytes:
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Audio exceeds the maximum allowed size.",
                    )
                out.write(chunk)
        if written == 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Empty audio upload.")
    except HTTPException:
        delete_audio_file(scratch_path)
        raise
    except OSError as exc:
        delete_audio_file(scratch_path)
        logger.exception("Failed writing scratch audio")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not store audio."
        ) from exc

    db = get_service_client()

    # Ownership check: the service role bypasses RLS, so the patient link
    # must be explicitly scoped to the authenticated clinician. A miss gets
    # the same 404 whether the patient is missing or belongs to someone else.
    if patient_uuid is not None:
        check = (
            db.table("patients")
            .select("id")
            .eq("id", patient_uuid)
            .eq("user_id", user.id)
            .execute()
        )
        if not check.data:
            delete_audio_file(scratch_path)
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No such patient.")

    # Create the session row up front so the client has something to poll.
    # patient_id is only included when set, so recording keeps working on a
    # database that hasn't applied migration 0004 yet.
    try:
        result = (
            db.table("sessions")
            .insert(
                {
                    "user_id": user.id,
                    "title": title.strip() or "Untitled session",
                    "status": SessionStatus.PROCESSING.value,
                    "audio_duration_seconds": duration_seconds or None,
                    **({"patient_id": patient_uuid} if patient_uuid else {}),
                }
            )
            .execute()
        )
        rows = cast(list[dict[str, object]], result.data)
        session_id = str(rows[0]["id"])
    except Exception as exc:
        delete_audio_file(scratch_path)
        logger.exception("Failed creating session row")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, detail="Could not create the session record."
        ) from exc

    background.add_task(
        run_transcription_pipeline, session_id, user.id, scratch_path, patient_uuid
    )
    return TranscriptionAccepted(session_id=session_id)
