"""Retention contract: scratch audio never survives the pipeline."""

from pathlib import Path
from unittest.mock import MagicMock, patch

from app.services.retention import delete_audio_file, run_transcription_pipeline


def test_delete_audio_file_removes_file(tmp_path: Path) -> None:
    f = tmp_path / "a.audio"
    f.write_bytes(b"fake-audio")
    delete_audio_file(f)
    assert not f.exists()


def test_delete_audio_file_tolerates_missing(tmp_path: Path) -> None:
    delete_audio_file(tmp_path / "never-existed.audio")  # must not raise


@patch("app.services.retention.get_service_client")
@patch("app.services.transcription.transcribe_audio")
def test_pipeline_purges_audio_on_success(
    mock_transcribe: MagicMock, mock_db: MagicMock, tmp_path: Path
) -> None:
    mock_transcribe.return_value = "I feel better this week."
    audio = tmp_path / "s.audio"
    audio.write_bytes(b"fake-audio")

    run_transcription_pipeline("sess-1", "user-1", audio)

    assert not audio.exists(), "audio must be purged after a successful run"
    mock_db.return_value.table.assert_called_with("sessions")


@patch("app.services.retention.get_service_client")
@patch("app.services.transcription.transcribe_audio")
def test_pipeline_purges_audio_on_failure(
    mock_transcribe: MagicMock, mock_db: MagicMock, tmp_path: Path
) -> None:
    mock_transcribe.side_effect = RuntimeError("model exploded")
    audio = tmp_path / "s.audio"
    audio.write_bytes(b"fake-audio")

    run_transcription_pipeline("sess-1", "user-1", audio)

    assert not audio.exists(), "audio must be purged even when the pipeline fails"
