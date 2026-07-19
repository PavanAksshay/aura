"""Daily quota on local-LLM (Ollama) usage.

Every AI call in Aura runs on one person's machine. Rate limiting already
smooths bursts, but it does not bound how much of the operator's compute a
guest can consume in a day — for that the count has to survive a restart,
which is why it lives in Postgres (migration 0019) rather than in memory.

The operator is exempt. That decision is keyed on the **JWT-verified** email
claim, never on anything the client sends separately, so it cannot be spoofed
by editing a profile row or a request body.

Deliberately applied to the on-demand AI actions — asking Memory a question,
summarising, redrafting a note — and NOT to recording. Recording is the reason
someone opens Aura at all; a guest who hits the quota should lose the extras,
not the ability to document the session in front of them.
"""

import logging
from collections.abc import Callable, Coroutine
from typing import Any, cast

from fastapi import Depends, HTTPException, status

from app.core.config import get_settings
from app.core.security import AuthenticatedUser, CurrentUser
from app.db.supabase import get_service_client

logger = logging.getLogger(__name__)


def _is_owner(email: str | None) -> bool:
    """True for the operator's own account, matched case-insensitively."""
    owner = get_settings().owner_email.strip().lower()
    return bool(owner and email and email.strip().lower() == owner)


def _quota_message() -> str:
    settings = get_settings()
    contact = settings.owner_email or "the operator"
    return (
        f"You've reached today's AI usage limit "
        f"({settings.ai_daily_limit} requests). "
        f"Please contact {contact} for more AI usage."
    )


def ai_quota() -> Callable[[AuthenticatedUser], Coroutine[Any, Any, AuthenticatedUser]]:
    """Dependency: count this AI call against the caller's daily allowance.

    Counts the attempt rather than the success. Charging only on success would
    let a caller with a reliably-failing request loop for free, and the compute
    is spent either way.
    """

    async def dependency(user: CurrentUser) -> AuthenticatedUser:
        settings = get_settings()
        if _is_owner(user.email):
            return user
        if settings.ai_daily_limit <= 0:
            return user  # limit disabled

        try:
            db = get_service_client()
            result = db.rpc("bump_ai_usage", {"p_user_id": user.id}).execute()
            used = cast(int, result.data)
        except Exception:
            # Fail open, loudly. A counter outage should not take away a
            # clinician's access to their own notes mid-session; the operator
            # sees the log and the rate limiter still caps throughput.
            logger.exception("AI quota check failed — allowing the request")
            return user

        if used > settings.ai_daily_limit:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS, detail=_quota_message()
            )
        return user

    return dependency


AiQuotaUser = Depends(ai_quota())
