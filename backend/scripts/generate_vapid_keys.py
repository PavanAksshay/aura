"""Generate a Web Push (VAPID) P-256 keypair in raw base64url form.

    python scripts/generate_vapid_keys.py

Copy VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY into backend/.env, and the SAME
public key into the frontend as NEXT_PUBLIC_VAPID_PUBLIC_KEY. If the two
public keys differ, the browser subscribes against a key the backend cannot
sign for and every push fails silently.

Rotating the keypair invalidates existing subscriptions — users must
re-enable notifications.
"""

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64url(raw: bytes) -> str:
    """Raw base64url, unpadded — the encoding the Web Push spec expects."""
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def main() -> None:
    key = ec.generate_private_key(ec.SECP256R1())
    public = key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    private = key.private_numbers().private_value.to_bytes(32, "big")

    print("# backend/.env")
    print(f"VAPID_PUBLIC_KEY={_b64url(public)}")
    print(f"VAPID_PRIVATE_KEY={_b64url(private)}")
    print()
    print("# frontend/.env.local (and Vercel env)")
    print(f"NEXT_PUBLIC_VAPID_PUBLIC_KEY={_b64url(public)}")


if __name__ == "__main__":
    main()
