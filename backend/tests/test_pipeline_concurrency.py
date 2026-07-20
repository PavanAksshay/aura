"""The transcription pipeline must not run many jobs at once.

Every job holds a Whisper model, a pyannote pass and an Ollama call on a single
machine. Ten simultaneous uploads used to start ten pipelines immediately —
FastAPI runs sync background tasks on the anyio threadpool — which does not
finish ten jobs in the time of one, it makes all ten slower and can exhaust
memory, killing jobs that were nearly done.
"""

import threading
import time
from pathlib import Path

from app.services import retention


def test_pipeline_runs_are_serialized(monkeypatch) -> None:
    """Concurrent calls must queue, not overlap."""
    running = 0
    peak = 0
    guard = threading.Lock()

    def fake_pipeline(
        session_id: str, user_id: str, audio_path: Path, patient_id: str | None
    ) -> None:
        nonlocal running, peak
        with guard:
            running += 1
            peak = max(peak, running)
        time.sleep(0.05)  # long enough for overlap to be observable
        with guard:
            running -= 1

    monkeypatch.setattr(retention, "_run_pipeline_locked", fake_pipeline)

    threads = [
        threading.Thread(
            target=retention.run_transcription_pipeline,
            args=(f"s{i}", "u1", Path(f"/tmp/none-{i}"), None),
        )
        for i in range(8)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    assert peak == 1, f"{peak} pipelines ran at once; the gate did not hold"


def test_every_queued_job_still_runs(monkeypatch) -> None:
    """Serializing must not drop work — the tenth clinician waits, not loses."""
    completed: list[str] = []
    guard = threading.Lock()

    def fake_pipeline(
        session_id: str, user_id: str, audio_path: Path, patient_id: str | None
    ) -> None:
        with guard:
            completed.append(session_id)

    monkeypatch.setattr(retention, "_run_pipeline_locked", fake_pipeline)

    threads = [
        threading.Thread(
            target=retention.run_transcription_pipeline,
            args=(f"s{i}", "u1", Path(f"/tmp/none-{i}"), None),
        )
        for i in range(10)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    assert sorted(completed) == sorted(f"s{i}" for i in range(10))


def test_a_failing_job_releases_its_slot(monkeypatch) -> None:
    """A crash must not permanently consume a slot and wedge the queue."""

    def exploding_pipeline(
        session_id: str, user_id: str, audio_path: Path, patient_id: str | None
    ) -> None:
        raise RuntimeError("pipeline blew up")

    monkeypatch.setattr(retention, "_run_pipeline_locked", exploding_pipeline)

    for _ in range(3):
        try:
            retention.run_transcription_pipeline("s", "u1", Path("/tmp/none"), None)
        except RuntimeError:
            pass

    # If the slot leaked, this acquire would block forever.
    assert retention._pipeline_slots.acquire(timeout=2), "slot leaked after a failure"
    retention._pipeline_slots.release()
