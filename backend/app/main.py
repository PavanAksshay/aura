"""Clinical Scribe API — application entrypoint.

Run locally with:
    uvicorn app.main:app --reload --port 8000
"""

import asyncio
import contextlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.services.reminders import reminder_loop


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Prepare the audio scratch dir on boot; purge any residue on shutdown.

    Residual audio can only exist if a previous process died mid-job, so the
    sweep on both edges keeps the ephemerality guarantee honest.

    Also runs the appointment-reminder scheduler for the life of the process.
    """
    settings = get_settings()
    settings.audio_scratch_dir.mkdir(parents=True, exist_ok=True)
    _purge_scratch(settings)

    reminders = asyncio.create_task(reminder_loop())
    try:
        yield
    finally:
        reminders.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await reminders
        _purge_scratch(settings)


def _purge_scratch(settings: Settings) -> None:
    for leftover in settings.audio_scratch_dir.glob("*"):
        leftover.unlink(missing_ok=True)


def create_app() -> FastAPI:
    settings = get_settings()
    # No public API docs in production — only expose the schema in development.
    is_dev = settings.environment == "development"
    app = FastAPI(
        title="Clinical Scribe API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if is_dev else None,
        redoc_url="/redoc" if is_dev else None,
        openapi_url="/openapi.json" if is_dev else None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        # The API authenticates via the Authorization header (Bearer JWT), not
        # cookies, so cross-origin credentials are neither used nor allowed.
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "ngrok-skip-browser-warning"],
    )
    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
