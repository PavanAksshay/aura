"""Aggregate router: every versioned route group is mounted here."""

from fastapi import APIRouter

from app.api.routes import checkin, health, memory, sessions, transcription

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(transcription.router, tags=["transcription"])
api_router.include_router(sessions.router, tags=["sessions"])
api_router.include_router(memory.router, tags=["memory"])
api_router.include_router(checkin.router, tags=["checkin"])
