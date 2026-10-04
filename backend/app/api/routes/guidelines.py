"""Clinical Reference Guidelines API: DSM-5-TR and ICD-11 RAG."""

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import AuthenticatedUser, get_current_user
from app.db.supabase import get_service_client
from app.models.schemas import CrossReferenceRequest
from app.services.guidelines import cross_reference_session_note, search_guidelines

router = APIRouter(prefix="/guidelines")


@router.post("/cross-reference")
async def cross_reference(
    payload: CrossReferenceRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Cross-reference a clinical note against DSM-5-TR and ICD-11 diagnostic criteria.

    Runs fully locally with FastEmbed semantic retrieval and local Ollama synthesis.
    """
    note_text = payload.note_text
    concerns = payload.patient_presenting_concerns

    if payload.session_id:
        supabase = get_service_client()
        result = (
            supabase.from_("sessions")
            .select("note, patient_id")
            .eq("id", payload.session_id)
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
        session_data = result.data
        note_json = session_data.get("note")
        if note_json:
            discussed = note_json.get("discussed", [])
            ahead = note_json.get("ahead", [])
            note_text = "Discussed:\n" + "\n".join(f"- {b}" for b in discussed)
            if ahead:
                note_text += "\n\nAhead:\n" + "\n".join(f"- {b}" for b in ahead)

        patient_id = session_data.get("patient_id")
        if patient_id and not concerns:
            p_res = (
                supabase.from_("patients")
                .select("presenting_concerns")
                .eq("id", patient_id)
                .maybe_single()
                .execute()
            )
            if p_res.data:
                concerns = p_res.data.get("presenting_concerns")

    if not note_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either session_id or note_text must be provided",
        )

    analysis = cross_reference_session_note(
        note_text=note_text,
        patient_presenting_concerns=concerns,
    )
    return analysis


@router.get("/search")
async def search(
    q: str = Query(..., min_length=2, description="Symptom or diagnostic query"),
    limit: int = Query(default=3, ge=1, le=10),
    user: AuthenticatedUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Search DSM-5 & ICD-11 criteria matching symptoms."""
    return search_guidelines(query=q, top_k=limit)
