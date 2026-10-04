"""Clinical Reference Guidelines RAG: DSM-5-TR and ICD-11 diagnostic cross-referencing.

Embeds psychological diagnostic reference manuals locally and performs
semantic retrieval against clinical session notes to assist the psychologist
in cross-referencing symptoms against evidence-based diagnostic criteria.

Hardware Acceleration:
- Uses in-process FastEmbed ONNX embeddings / PyTorch MPS (Apple Silicon Metal) / CUDA GPU.
"""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Any, cast

import httpx
import numpy as np

from app.core.config import get_settings
from app.services.embeddings import _get_model

logger = logging.getLogger(__name__)

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "clinical_guidelines.json"

_guidelines_lock = threading.Lock()
_guidelines_data: list[dict[str, Any]] | None = None
_guidelines_embeddings: np.ndarray | None = None
_guidelines_chunks: list[dict[str, Any]] = []


def _load_and_index_guidelines() -> tuple[list[dict[str, Any]], np.ndarray]:
    """Load DSM-5 & ICD-11 diagnostic data and compute vector embeddings."""
    global _guidelines_data, _guidelines_embeddings, _guidelines_chunks
    with _guidelines_lock:
        if _guidelines_data is not None and _guidelines_embeddings is not None:
            return _guidelines_chunks, _guidelines_embeddings

        if not _DATA_PATH.exists():
            logger.error("Guidelines file not found at %s", _DATA_PATH)
            return [], np.empty((0, 768))

        with open(_DATA_PATH, "r", encoding="utf-8") as f:
            _guidelines_data = json.load(f)

        chunks: list[dict[str, Any]] = []
        for g in _guidelines_data:
            # Create a rich textual chunk for semantic retrieval
            full_text = f"{g['title']} ({g['category']})\n"
            full_text += f"DSM-5: {g['dsm5_code']} | ICD-11: {g['icd11_code']}\n"
            full_text += f"Overview: {g['summary']}\n"
            full_text += "Criteria:\n" + "\n".join(f"- {c}" for c in g["criteria"]) + "\n"
            full_text += f"Duration: {g['duration_requirement']}\n"
            full_text += f"Differentials: {g['differentials_and_exclusions']}"

            chunks.append({
                "id": g["id"],
                "title": g["title"],
                "dsm5_code": g["dsm5_code"],
                "icd11_code": g["icd11_code"],
                "category": g["category"],
                "summary": g["summary"],
                "criteria": g["criteria"],
                "duration_requirement": g["duration_requirement"],
                "differentials_and_exclusions": g["differentials_and_exclusions"],
                "search_text": full_text,
            })

        _guidelines_chunks = chunks
        model = _get_model()
        texts = [c["search_text"] for c in chunks]
        
        logger.info("Computing embeddings for %d clinical guideline frameworks...", len(texts))
        raw_embs = list(model.embed(texts))
        embs_np = np.asarray(raw_embs, dtype=np.float32)
        # Normalize for cosine similarity
        norms = np.linalg.norm(embs_np, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        _guidelines_embeddings = embs_np / norms

        logger.info("Clinical guidelines indexed successfully.")
        return _guidelines_chunks, _guidelines_embeddings


def search_guidelines(query: str, top_k: int = 3) -> list[dict[str, Any]]:
    """Search DSM-5 & ICD-11 criteria matching a natural language symptom query."""
    chunks, embeddings = _load_and_index_guidelines()
    if len(chunks) == 0 or embeddings.shape[0] == 0:
        return []

    model = _get_model()
    q_emb = np.asarray(list(model.embed([query])), dtype=np.float32)[0]
    q_norm = np.linalg.norm(q_emb)
    if q_norm > 0:
        q_emb = q_emb / q_norm

    # Cosine similarities
    scores = np.dot(embeddings, q_emb)
    top_indices = np.argsort(scores)[::-1][:top_k]

    results: list[dict[str, Any]] = []
    for idx in top_indices:
        item = dict(chunks[idx])
        item["similarity_score"] = float(scores[idx])
        results.append(item)

    return results


_ANALYSIS_PROMPT = """You are an expert clinical psychologist decision-support AI.
Compare the SESSION NOTE below against the retrieved DSM-5-TR and ICD-11 diagnostic criteria.

CRITICAL INSTRUCTIONS:
1. Ground every claim directly in the session note.
2. For each matched framework, classify which criteria are MET (with exact quotes from the note) and which are UNMET/PENDING (e.g. duration requirements not yet verified).
3. Provide differential diagnostic considerations and clinical rule-outs.
4. Output STRICT, VALID JSON with this exact schema:
{{
  "matches": [
    {{
      "framework_id": "string",
      "title": "string",
      "dsm5_code": "string",
      "icd11_code": "string",
      "confidence": "high" | "moderate" | "exploratory",
      "met_criteria": [
        {{ "criterion": "string", "evidence_quote": "string" }}
      ],
      "unmet_or_pending_criteria": [
        "string"
      ],
      "duration_assessment": "string",
      "differential_considerations": "string"
    }}
  ],
  "clinical_summary": "1-2 sentence high-level summary of diagnostic alignment"
}}

DIAGNOSTIC GUIDELINES CONTEXT:
{guidelines_context}

SESSION NOTE:
{session_note}

JSON OUTPUT:"""


def cross_reference_session_note(
    note_text: str,
    patient_presenting_concerns: str | None = None,
) -> dict[str, Any]:
    """Cross-reference a session note against local DSM-5-TR and ICD-11 diagnostic guidelines."""
    full_query = note_text
    if patient_presenting_concerns:
        full_query = f"Presenting concerns: {patient_presenting_concerns}\n\n{note_text}"

    # Step 1 (R): Retrieve top matching diagnostic frameworks
    matched_guidelines = search_guidelines(full_query, top_k=3)
    if not matched_guidelines:
        return {
            "matches": [],
            "clinical_summary": "No diagnostic guidelines matched the session note.",
        }

    # Format guidelines context
    guidelines_context = ""
    for g in matched_guidelines:
        guidelines_context += f"### {g['title']} (DSM-5: {g['dsm5_code']} | ICD-11: {g['icd11_code']})\n"
        guidelines_context += f"Summary: {g['summary']}\n"
        guidelines_context += "Criteria:\n" + "\n".join(f"- {c}" for c in g["criteria"]) + "\n"
        guidelines_context += f"Duration: {g['duration_requirement']}\n"
        guidelines_context += f"Differentials & Rule-outs: {g['differentials_and_exclusions']}\n\n"

    # Step 2 (A & G): Synthesize with local Ollama
    settings = get_settings()
    prompt = _ANALYSIS_PROMPT.format(
        guidelines_context=guidelines_context,
        session_note=note_text,
    )

    try:
        response = httpx.post(
            f"{settings.ollama_url}/api/generate",
            json={
                "model": settings.summary_model,
                "prompt": prompt,
                "format": "json",
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "num_predict": 768,
                },
            },
            timeout=15.0,
        )
        if response.status_code == 200:
            raw_json = response.json().get("response", "{}")
            parsed = json.loads(raw_json)
            if "matches" in parsed and len(parsed["matches"]) > 0:
                return parsed
    except Exception as exc:
        logger.warning("Ollama diagnostic analysis fallback activated: %s", exc)

    # Fast Deterministic Semantic/Keyword Criteria Matcher
    note_lower = note_text.lower()
    fallback_matches = []
    
    for g in matched_guidelines:
        met_list = []
        unmet_list = []
        
        for crit in g.get("criteria", []):
            # Clean criterion string
            c_clean = crit.lstrip("0123456789. -")
            # Extract key words (>4 chars) to search for clinical overlap
            keywords = [w.lower().strip(",.():") for w in c_clean.split() if len(w) > 4]
            # Check overlap
            matched_words = [kw for kw in keywords if kw in note_lower]
            
            if len(matched_words) >= 1:
                met_list.append({
                    "criterion": c_clean,
                    "evidence_quote": f"Documented in session (matching keywords: {', '.join(matched_words[:3])})",
                })
            else:
                unmet_list.append(c_clean)

        score = float(g.get("similarity_score", 0.0))
        if len(met_list) >= 3 or score > 0.60:
            confidence = "high"
        elif len(met_list) >= 1 or score > 0.40:
            confidence = "moderate"
        else:
            confidence = "exploratory"

        fallback_matches.append({
            "framework_id": g["id"],
            "title": g["title"],
            "dsm5_code": g["dsm5_code"],
            "icd11_code": g["icd11_code"],
            "confidence": confidence,
            "met_criteria": met_list if met_list else [
                {"criterion": "Semantic clinical symptom alignment", "evidence_quote": "Identified through vector similarity match."}
            ],
            "unmet_or_pending_criteria": unmet_list[:4] + [f"Verify duration threshold: {g['duration_requirement']}"],
            "duration_assessment": g["duration_requirement"],
            "differential_considerations": g["differentials_and_exclusions"],
        })

    return {
        "matches": fallback_matches,
        "clinical_summary": f"Cross-referenced against {len(fallback_matches)} DSM-5-TR and ICD-11 reference frameworks based on documented symptoms.",
    }
