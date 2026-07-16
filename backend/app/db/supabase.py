"""Service-role Supabase client.

This client BYPASSES Row Level Security — it exists so the backend can drive
session status transitions and the transcript purge regardless of client
state. It must never be handed data derived from an unverified identity:
every call site receives the user id from a verified JWT (see
app.core.security) and scopes its queries with it explicitly.
"""

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_service_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
