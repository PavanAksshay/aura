"""Daily well-being check-in with an owner reply loop.

One named user (settings.checkin_user_email) is greeted once per local day after
onboarding, can leave a short message, and the operator is notified, reads it in
an owner-only inbox, and replies — which pushes back to her.

All database access uses the service client scoped by the JWT-verified user id;
the owner endpoints are additionally gated on owner_email. Nothing here trusts a
client-supplied identity.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any, cast

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.quota import _is_owner
from app.core.security import CurrentUser
from app.db.supabase import get_service_client
from app.services.push import push_configured, send_push

logger = logging.getLogger(__name__)
router = APIRouter()

# The exact options the client offers; anything else is rejected.
_MOODS = {
    "Good",
    "Great",
    "Never felt better",
    "Nah, i don't wan't to talk about it",
}

# Resolved auth-user ids by lower-cased email. Owner id rarely changes, so a
# tiny in-process cache avoids repeating the admin lookup on every message.
_id_by_email: dict[str, str] = {}


class CheckinSubmit(BaseModel):
    mood: str
    message: str | None = Field(default=None, max_length=4000)
    local_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class ReplyBody(BaseModel):
    reply: str = Field(min_length=1, max_length=4000)


def _is_checkin_user(email: str | None) -> bool:
    target = get_settings().checkin_user_email.strip().lower()
    return bool(target and email and email.strip().lower() == target)


def _resolve_user_id(email: str) -> str | None:
    """Best-effort auth-user id for an email, via the admin API. Cached."""
    key = email.strip().lower()
    if not key:
        return None
    if key in _id_by_email:
        return _id_by_email[key]
    try:
        users = get_service_client().auth.admin.list_users()
        for u in users:
            if (getattr(u, "email", "") or "").lower() == key:
                _id_by_email[key] = u.id
                return u.id
    except Exception:
        logger.warning("Could not resolve user id for %s", key, exc_info=True)
    return None


def _profile_first_name(user_id: str) -> str:
    try:
        data = (
            get_service_client()
            .table("profiles").select("full_name").eq("id", user_id).limit(1)
            .execute().data
        )
        name = (data[0].get("full_name") if data else "") or ""
        first = name.strip().split()[0] if name.strip() else ""
        return first or "Someone"
    except Exception:
        return "Someone"


def _notify_user(user_id: str | None, payload: dict[str, Any]) -> None:
    """Push to every browser a user has registered. Best-effort, never raises."""
    if not user_id or not push_configured():
        return
    try:
        subs = (
            get_service_client()
            .table("push_subscriptions")
            .select("endpoint, p256dh, auth, user_id")
            .eq("user_id", user_id)
            .execute().data
            or []
        )
        for sub in subs:
            send_push(sub, payload)
    except Exception:
        logger.warning("Check-in push failed", exc_info=True)


@router.get("/checkin/state")
def checkin_state(user: CurrentUser, local_date: str) -> dict[str, Any]:
    """Whether to show the check-in today, plus any unseen reply for her."""
    if not _is_checkin_user(user.email):
        return {"enabled": False, "done_today": False, "pending_reply": None}

    db = get_service_client()
    done = (
        db.table("daily_checkins").select("id")
        .eq("user_id", user.id).eq("checkin_date", local_date).limit(1)
        .execute().data
    )
    pending_rows = (
        db.table("daily_checkins").select("id, owner_reply, owner_replied_at")
        .eq("user_id", user.id)
        .not_.is_("owner_reply", "null").is_("reply_seen_at", "null")
        .order("owner_replied_at", desc=True).limit(1)
        .execute().data
    )
    pending = None
    if pending_rows:
        r = pending_rows[0]
        pending = {
            "id": r["id"],
            "reply": r["owner_reply"],
            "replied_at": r["owner_replied_at"],
        }
    return {"enabled": True, "done_today": bool(done), "pending_reply": pending}


@router.post("/checkin", status_code=status.HTTP_201_CREATED)
def submit_checkin(user: CurrentUser, body: CheckinSubmit) -> dict[str, bool]:
    if not _is_checkin_user(user.email):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Check-in is not enabled here.")
    if body.mood not in _MOODS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown mood.")

    message = (body.message or "").strip() or None
    db = get_service_client()
    result = (
        db.table("daily_checkins")
        .upsert(
            {
                "user_id": user.id,
                "checkin_date": body.local_date,
                "mood": body.mood,
                "message": message,
            },
            on_conflict="user_id,checkin_date",
        )
        .execute()
    )
    checkin_id = result.data[0]["id"] if result.data else None

    if message:
        owner_id = _resolve_user_id(get_settings().owner_email)
        _notify_user(owner_id, {
            "title": "Aura",
            "body": f"{_profile_first_name(user.id)} sent you a message 💬",
            "tag": f"checkin-{checkin_id}",
            "url": "/inbox",
        })
    return {"ok": True}


@router.post("/checkin/{checkin_id}/seen")
def mark_reply_seen(user: CurrentUser, checkin_id: str) -> dict[str, bool]:
    (
        get_service_client()
        .table("daily_checkins")
        .update({"reply_seen_at": datetime.now(UTC).isoformat()})
        .eq("id", checkin_id).eq("user_id", user.id)
        .execute()
    )
    return {"ok": True}


@router.get("/checkin/inbox")
def checkin_inbox(user: CurrentUser) -> dict[str, Any]:
    if not _is_owner(user.email):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Owner only.")

    db = get_service_client()
    rows = cast(
        list[dict[str, Any]],
        db.table("daily_checkins").select("*")
        .not_.is_("message", "null")
        .order("created_at", desc=True).limit(200)
        .execute().data or [],
    )
    ids = list({r["user_id"] for r in rows})
    names: dict[str, str | None] = {}
    if ids:
        profs = (
            db.table("profiles").select("id, full_name").in_("id", ids)
            .execute().data or []
        )
        names = {p["id"]: p.get("full_name") for p in profs}

    items = [
        {
            "id": r["id"],
            "name": names.get(r["user_id"]),
            "mood": r["mood"],
            "message": r["message"],
            "owner_reply": r.get("owner_reply"),
            "owner_replied_at": r.get("owner_replied_at"),
            "created_at": r["created_at"],
        }
        for r in rows
    ]
    return {"items": items}


@router.post("/checkin/inbox/{checkin_id}/reply")
def reply_to_checkin(
    user: CurrentUser, checkin_id: str, body: ReplyBody
) -> dict[str, bool]:
    if not _is_owner(user.email):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Owner only.")

    result = (
        get_service_client()
        .table("daily_checkins")
        .update({
            "owner_reply": body.reply.strip(),
            "owner_replied_at": datetime.now(UTC).isoformat(),
            # Clear the seen stamp so a fresh reply notifies her again.
            "reply_seen_at": None,
        })
        .eq("id", checkin_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Check-in not found.")

    _notify_user(result.data[0]["user_id"], {
        "title": "Aura",
        "body": "Aura replied to you 💬",
        "tag": f"checkin-reply-{checkin_id}",
        "url": "/dashboard",
    })
    return {"ok": True}
