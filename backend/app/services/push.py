"""Web Push delivery for appointment reminders.

Sends VAPID-signed pushes to a clinician's registered browsers. Push endpoints
go stale constantly (browser reinstalled, permission revoked, subscription
rotated), so a 404/410 from the push service is treated as authoritative and
the dead subscription is pruned rather than retried forever.
"""

import json
import logging
from typing import Any, cast

from pywebpush import WebPushException, webpush

from app.core.config import get_settings
from app.db.supabase import get_service_client

logger = logging.getLogger(__name__)


def push_configured() -> bool:
    settings = get_settings()
    return bool(settings.vapid_public_key and settings.vapid_private_key)


def _forget_subscription(endpoint: str, user_id: str | None) -> None:
    """Drop a dead subscription, scoped by owner whenever we know it.

    The endpoint currently comes from our own database rather than from a
    request, so an unscoped delete is not exploitable today. It goes in anyway:
    an unscoped delete on a shared table is precisely what turns into a hole
    the first time a caller passes user input, and the cost of the filter is
    nothing.
    """
    try:
        db = get_service_client()
        query = db.table("push_subscriptions").delete().eq("endpoint", endpoint)
        if user_id:
            query = query.eq("user_id", user_id)
        query.execute()
        logger.info("Pruned expired push subscription")
    except Exception:
        logger.exception("Failed pruning expired push subscription")


def send_push(subscription: dict[str, Any], payload: dict[str, Any]) -> bool:
    """Deliver one push. Returns True on success. Never raises.

    `subscription` is a row from push_subscriptions (endpoint/p256dh/auth);
    include `user_id` so a dead-subscription cleanup stays owner-scoped.
    """
    settings = get_settings()
    endpoint = cast(str, subscription["endpoint"])
    try:
        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {
                    "p256dh": subscription["p256dh"],
                    "auth": subscription["auth"],
                },
            },
            data=json.dumps(payload),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
            timeout=10,
        )
        return True
    except WebPushException as exc:
        status_code = getattr(exc.response, "status_code", None)
        # 404/410: the subscription is permanently gone — stop trying.
        if status_code in (404, 410):
            _forget_subscription(endpoint, subscription.get("user_id"))
        else:
            logger.warning("Web push failed (status=%s)", status_code)
        return False
    except Exception:
        logger.exception("Unexpected error sending web push")
        return False
