"""Supabase JWT verification.

The frontend sends the user's Supabase access token as a Bearer header. We
verify it locally rather than round-tripping to Supabase on every request.

Supabase projects sign access tokens one of two ways:

* **Asymmetric** (ES256/RS256) — the current default for new projects. Tokens
  are verified against the project's public keys, published at the JWKS
  endpoint. No shared secret is involved.
* **Legacy symmetric** (HS256) — verified against the project's JWT secret.

We inspect each token's header and use the matching path, so the backend
works regardless of which signing scheme the project uses. (An earlier
HS256-only implementation rejected every asymmetric token as "invalid".)
"""

import logging
import ssl
from dataclasses import dataclass
from typing import Annotated, Any

import certifi
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)
_ASYMMETRIC_ALGORITHMS = ["ES256", "RS256"]
_REQUIRED_CLAIMS = ["exp", "sub", "aud"]

# Lazily built, then cached: the JWKS client fetches + caches the project's
# public signing keys, so verification stays local after the first call.
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        settings = get_settings()
        jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        # PyJWKClient fetches over urllib, whose default SSL context uses the
        # OS trust store — which is unpopulated on macOS Python builds, so the
        # fetch dies with CERTIFICATE_VERIFY_FAILED. Pin certifi's CA bundle
        # (the same roots curl/httpx already trust) so the fetch succeeds.
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        _jwks_client = PyJWKClient(jwks_url, ssl_context=ssl_context)
    return _jwks_client


@dataclass(frozen=True)
class AuthenticatedUser:
    """Verified identity extracted from a Supabase access token."""

    id: str  # auth.users.id (uuid)
    email: str | None


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode(token: str) -> dict[str, Any]:
    """Verify a Supabase JWT, choosing HS256 vs asymmetric by its header."""
    settings = get_settings()
    algorithm = jwt.get_unverified_header(token).get("alg", "")

    if algorithm == "HS256":
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": _REQUIRED_CLAIMS},
        )

    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=_ASYMMETRIC_ALGORITHMS,
        audience="authenticated",
        options={"require": _REQUIRED_CLAIMS},
    )


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AuthenticatedUser:
    settings = get_settings()
    is_dev = settings.environment == "development"

    if credentials is None:
        if is_dev:
            return AuthenticatedUser(
                id="07104c38-689d-4246-bd0a-036bc1d5faf1",
                email=settings.owner_email or "pavanaksshay07@gmail.com",
            )
        raise _unauthorized("Missing bearer token")

    token = credentials.credentials
    try:
        payload = _decode(token)
    except Exception as exc:
        if is_dev:
            logger.warning("Dev mode JWT verification failed (%s), extracting unverified claims", exc)
            try:
                payload = jwt.decode(token, options={"verify_signature": False})
            except Exception:
                payload = {"sub": "07104c38-689d-4246-bd0a-036bc1d5faf1", "email": settings.owner_email}
        else:
            logger.warning("JWT rejected: %s", type(exc).__name__)
            raise _unauthorized("Invalid or expired token") from exc

    sub = payload.get("sub")
    if not isinstance(sub, str):
        raise _unauthorized("Malformed token subject")
    email = payload.get("email")
    return AuthenticatedUser(id=sub, email=email if isinstance(email, str) else None)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
