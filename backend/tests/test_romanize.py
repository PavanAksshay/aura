"""Romanizing a non-English transcript to the Latin alphabet.

The clinical note is built from the original transcript, not this romanized
copy, so these tests care about one guarantee above all: the stored transcript
must never keep Tamil/Devanagari letters, even when the model is unavailable.
"""

from app.services.romanize import has_indic_letters, romanize_transcript

TAMIL = (
    "Therapist: Vanakkam, indha vaaram eppadi irundheenga?\n"
    "Patient: சார், ரொம்ப stress ஆ இருக்கு. தூக்கமே வரலை.\n"
    "Therapist: Sari, oru breathing exercise try pannunga."
)
HINDI = "Patient: मुझे बहुत तनाव है और नींद नहीं आती।"


def test_english_is_returned_untouched() -> None:
    text = "Patient: I have not been sleeping well this week."
    assert romanize_transcript(text, use_llm=False) == text


def test_mechanical_fallback_removes_all_tamil_letters() -> None:
    out = romanize_transcript(TAMIL, use_llm=False)
    assert not has_indic_letters(out)
    # English that was already Latin survives.
    assert "breathing exercise" in out
    # Speaker structure is preserved.
    assert out.count("\n") == TAMIL.count("\n")


def test_mechanical_fallback_removes_all_devanagari_letters() -> None:
    out = romanize_transcript(HINDI, use_llm=False)
    assert not has_indic_letters(out)


def test_has_indic_letters() -> None:
    assert has_indic_letters("ரொம்ப")
    assert has_indic_letters("नींद")
    assert not has_indic_letters("romba stress-a irukku")
    assert not has_indic_letters("")
