"""Per-user rate limiting for the expensive endpoints.

Transcription, summarization, and memory answering each pin CPU for seconds to
minutes (Whisper, pyannote, Ollama, embeddings), so an authenticated caller
looping any of them can trivially exhaust the box. These limits are a safety
valve against runaway clients and accidental retry storms.

Scope: a fixed window held in process memory, keyed by the verified user id.
That is the right weight for this deployment (single process, few clinicians)
but it resets on restart and is not shared across workers — move the counters
to Redis if the API is ever scaled out.
"""

import time
from collections import defaultdict, deque
from collections.abc import Callable
from threading import Lock

from fastapi import HTTPException, status

from app.core.security import CurrentUser


class _FixedWindowLimiter:
    def __init__(self, limit: int, window_seconds: float) -> None:
        self._limit = limit
        self._window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        cutoff = now - self._window
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= cutoff:
                hits.popleft()

            if len(hits) >= self._limit:
                retry_after = max(1, int(hits[0] + self._window - now) + 1)
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests — please wait a moment and try again.",
                    headers={"Retry-After": str(retry_after)},
                )

            hits.append(now)
            if not hits:  # keep the map from growing unbounded
                del self._hits[key]


def rate_limit(limit: int, window_seconds: float) -> Callable[[CurrentUser], None]:
    """Build a dependency enforcing `limit` requests per `window_seconds` per user."""
    limiter = _FixedWindowLimiter(limit, window_seconds)

    def dependency(user: CurrentUser) -> None:
        limiter.check(user.id)

    return dependency
