"""Pydantic request/response models — mirror frontend/lib/types.ts."""

from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class SessionStatus(StrEnum):
    PROCESSING = "processing"
    READY = "ready"
    EXPORTED = "exported"
    FAILED = "failed"


class SoapNote(BaseModel):
    """The structured clinical note. This is the only artifact that persists."""

    subjective: str = Field(description="Client-reported experience, symptoms, concerns.")
    objective: str = Field(description="Clinician-observable data: affect, behavior, MSE.")
    assessment: str = Field(description="Clinical interpretation, progress, risk factors.")
    plan: str = Field(description="Interventions, homework, next-session goals.")


class TranscriptionAccepted(BaseModel):
    """202 response: the pipeline is running; poll the session row for status."""

    session_id: str
    status: SessionStatus = SessionStatus.PROCESSING


class SessionSummary(BaseModel):
    """Structured summary of a session transcript (shown beside the full text)."""

    patient_name: str = ""
    age: str = ""
    personal_details: str = ""
    discussion: str = ""
    engine: str = "heuristic"  # "ollama" | "heuristic"


class ChatTurn(BaseModel):
    """One prior turn of a memory chat, sent along for follow-up questions."""

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class MemorySearchRequest(BaseModel):
    """Semantic query over the caller's own exported notes.

    `history` carries the recent turns of the current chat so the model can
    resolve follow-ups ("which of those helped?"). Hard-capped so a client
    can't stuff the local model's context.
    """

    query: str = Field(min_length=1, max_length=500)
    patient_id: str | None = None
    limit: int = Field(default=8, ge=1, le=20)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)


class MemoryMatchOut(BaseModel):
    """One retrieved note chunk, ranked by cosine similarity."""

    session_id: str
    patient_id: str | None
    chunk_index: int
    content: str
    similarity: float


class MemoryAnswer(BaseModel):
    """A concise, synthesized answer to a memory question + supporting excerpts."""

    answer: str
    engine: str = "heuristic"  # "ollama" | "heuristic"
    matches: list[MemoryMatchOut]


class SessionOut(BaseModel):
    id: str
    user_id: str
    title: str
    status: SessionStatus
    audio_duration_seconds: int | None
    raw_transcript: str | None
    soap: SoapNote | None
    error_detail: str | None
    created_at: datetime
    updated_at: datetime
    exported_at: datetime | None
