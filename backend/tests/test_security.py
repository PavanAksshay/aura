"""JWT verification behavior: valid tokens bind identity, bad tokens 401."""

import time

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core.config import get_settings
from app.core.security import get_current_user

SECRET = "test-secret"


@pytest.fixture(autouse=True)
def _configure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    get_settings.cache_clear()


def _creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _make_token(secret: str = SECRET, exp_offset: int = 3600) -> str:
    return jwt.encode(
        {
            "sub": "11111111-2222-3333-4444-555555555555",
            "email": "clinician@example.com",
            "aud": "authenticated",
            "exp": int(time.time()) + exp_offset,
        },
        secret,
        algorithm="HS256",
    )


def test_valid_token_yields_user() -> None:
    user = get_current_user(_creds(_make_token()))
    assert user.id == "11111111-2222-3333-4444-555555555555"
    assert user.email == "clinician@example.com"


def test_missing_token_is_401() -> None:
    with pytest.raises(HTTPException) as exc:
        get_current_user(None)
    assert exc.value.status_code == 401


def test_wrong_secret_is_401() -> None:
    with pytest.raises(HTTPException) as exc:
        get_current_user(_creds(_make_token(secret="attacker-secret")))
    assert exc.value.status_code == 401


def test_expired_token_is_401() -> None:
    with pytest.raises(HTTPException) as exc:
        get_current_user(_creds(_make_token(exp_offset=-60)))
    assert exc.value.status_code == 401
