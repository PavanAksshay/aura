"""AI usage quota: owner exemption and limit enforcement."""

import pytest
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.quota import _is_owner, _quota_message, ai_quota
from app.core.security import AuthenticatedUser


@pytest.fixture(autouse=True)
def _owner_config(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("OWNER_EMAIL", "owner@example.com")
    monkeypatch.setenv("AI_DAILY_LIMIT", "3")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_owner_matches_case_insensitively() -> None:
    assert _is_owner("owner@example.com")
    assert _is_owner("Owner@Example.COM")
    assert _is_owner("  owner@example.com  ")


def test_non_owner_and_missing_email_are_not_exempt() -> None:
    assert not _is_owner("someone@else.com")
    assert not _is_owner(None)
    assert not _is_owner("")


def test_message_names_the_contact_address() -> None:
    message = _quota_message()
    assert "owner@example.com" in message
    assert "3" in message


@pytest.mark.asyncio
async def test_owner_is_never_counted(monkeypatch: pytest.MonkeyPatch) -> None:
    """The owner must not even touch the counter — no DB call, no limit."""

    def _explode() -> None:  # pragma: no cover - must not be reached
        raise AssertionError("owner should not hit the usage counter")

    monkeypatch.setattr("app.core.quota.get_service_client", _explode)
    user = AuthenticatedUser(id="u1", email="owner@example.com")
    assert await ai_quota()(user) is user


@pytest.mark.asyncio
async def test_guest_over_limit_gets_429_with_contact(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _Result:
        data = 4  # limit is 3

    class _DB:
        def rpc(self, *_args: object, **_kwargs: object) -> "_DB":
            return self

        def execute(self) -> _Result:
            return _Result()

    monkeypatch.setattr("app.core.quota.get_service_client", lambda: _DB())
    user = AuthenticatedUser(id="u2", email="guest@example.com")

    with pytest.raises(HTTPException) as exc:
        await ai_quota()(user)
    assert exc.value.status_code == 429
    assert "owner@example.com" in exc.value.detail


@pytest.mark.asyncio
async def test_guest_under_limit_passes(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Result:
        data = 3  # exactly at the limit is still allowed

    class _DB:
        def rpc(self, *_args: object, **_kwargs: object) -> "_DB":
            return self

        def execute(self) -> _Result:
            return _Result()

    monkeypatch.setattr("app.core.quota.get_service_client", lambda: _DB())
    user = AuthenticatedUser(id="u3", email="guest@example.com")
    assert await ai_quota()(user) is user


@pytest.mark.asyncio
async def test_counter_outage_fails_open(monkeypatch: pytest.MonkeyPatch) -> None:
    """A broken counter must not lock a clinician out of their own notes."""

    def _boom() -> None:
        raise RuntimeError("database unreachable")

    monkeypatch.setattr("app.core.quota.get_service_client", _boom)
    user = AuthenticatedUser(id="u4", email="guest@example.com")
    assert await ai_quota()(user) is user
