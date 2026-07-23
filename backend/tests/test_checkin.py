"""The daily check-in gate: only the configured user is ever enabled."""

from app.api.routes.checkin import _MOODS, _is_checkin_user


def test_only_the_configured_email_is_enabled() -> None:
    # Default config points at the one intended account.
    assert _is_checkin_user("chandhanasd2007@gmail.com")
    # Case and surrounding whitespace don't matter.
    assert _is_checkin_user("  Chandhanasd2007@Gmail.com  ")
    # Nobody else, and never a missing email.
    assert not _is_checkin_user("someone-else@example.com")
    assert not _is_checkin_user(None)
    assert not _is_checkin_user("")


def test_mood_options_match_the_client() -> None:
    # These strings are compared verbatim on submit, so they must stay in sync
    # with the buttons in DailyCheckin.tsx (including the exact wording).
    assert _MOODS == {
        "Good",
        "Great",
        "Never felt better",
        "Nah, i don't wan't to talk about it",
    }
