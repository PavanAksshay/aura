"""Background scheduler: push a reminder shortly before each appointment.

Wakes every `reminder_poll_seconds`, finds scheduled appointments starting
within the next `reminder_lead_minutes` that haven't been reminded yet, and
pushes to each of that clinician's registered browsers. `reminder_sent_at` is
stamped so a reminder is sent exactly once even across restarts.

This runs in the API process, so reminders are delivered whenever the backend
is running — independent of whether the clinician has Aura open. It reads
across users via the service role, which is why every query is explicitly
scoped by user_id when fanning out.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from app.core.config import get_settings
from app.db.supabase import get_service_client
from app.services.push import push_configured, send_push

logger = logging.getLogger(__name__)


def _due_appointments(lead_minutes: int) -> list[dict[str, Any]]:
    now = datetime.now(UTC)
    horizon = now + timedelta(minutes=lead_minutes)
    db = get_service_client()
    result = (
        db.table("appointments")
        .select("id, user_id, title, starts_at")
        .eq("status", "scheduled")
        .is_("reminder_sent_at", "null")
        .gte("starts_at", now.isoformat())
        .lte("starts_at", horizon.isoformat())
        .execute()
    )
    return cast(list[dict[str, Any]], result.data or [])


def _subscriptions_for(user_id: str) -> list[dict[str, Any]]:
    db = get_service_client()
    result = (
        db.table("push_subscriptions")
        .select("endpoint, p256dh, auth, user_id")
        .eq("user_id", user_id)
        .execute()
    )
    return cast(list[dict[str, Any]], result.data or [])


def _mark_sent(appointment_id: str) -> None:
    db = get_service_client()
    db.table("appointments").update(
        {"reminder_sent_at": datetime.now(UTC).isoformat()}
    ).eq("id", appointment_id).execute()


def _run_once(lead_minutes: int) -> None:
    """One sweep. Blocking (Supabase + pywebpush are sync) — call in a thread."""
    for appt in _due_appointments(lead_minutes):
        appointment_id = str(appt["id"])
        subs = _subscriptions_for(str(appt["user_id"]))
        if not subs:
            # Nobody to notify on this account; don't re-check it every minute.
            _mark_sent(appointment_id)
            continue

        starts = datetime.fromisoformat(str(appt["starts_at"]))
        minutes = max(1, round((starts - datetime.now(UTC)).total_seconds() / 60))
        payload = {
            "title": "Appointment soon",
            "body": f"“{appt['title']}” starts in {minutes} min.",
            "tag": f"appt-{appointment_id}",
            "url": "/schedule",
        }

        delivered = any(send_push(sub, payload) for sub in subs)
        # Stamp regardless: a reminder that couldn't be delivered now is stale
        # by the next sweep, and retrying would spam once the browser returns.
        _mark_sent(appointment_id)
        if delivered:
            logger.info("Pushed reminder for appointment %s", appointment_id)


async def reminder_loop() -> None:
    """Long-lived task started from the app lifespan."""
    settings = get_settings()
    if not push_configured():
        logger.info("Web push not configured — appointment reminders disabled.")
        return

    logger.info(
        "Appointment reminder scheduler started (lead=%dm, poll=%ds)",
        settings.reminder_lead_minutes,
        settings.reminder_poll_seconds,
    )
    while True:
        try:
            await asyncio.to_thread(_run_once, settings.reminder_lead_minutes)
        except asyncio.CancelledError:
            raise
        except Exception:
            # Never let a bad sweep kill the loop.
            logger.exception("Reminder sweep failed")
        await asyncio.sleep(settings.reminder_poll_seconds)
