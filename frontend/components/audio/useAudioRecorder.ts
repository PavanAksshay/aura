"use client";

/**
 * Microphone capture hook.
 *
 * Owns the full MediaRecorder lifecycle: permission request, recording,
 * elapsed-time tracking, a live input level (via WebAudio AnalyserNode),
 * and — critically for a clinical tool — deterministic teardown. Tracks are
 * stopped and buffers dropped on stop, error, and unmount, so audio never
 * outlives the capture screen except as the one Blob handed to the caller.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus =
  | "idle"
  | "requesting" // waiting on the browser permission prompt
  | "recording"
  | "stopped"
  | "error";

export interface AudioRecorderState {
  status: RecorderStatus;
  /** Seconds elapsed since recording began. */
  elapsed: number;
  /** Smoothed input level in [0, 1] for visual feedback. */
  level: number;
  /** Live AnalyserNode while recording (null otherwise) — feeds the waveform. */
  analyserRef: React.RefObject<AnalyserNode | null>;
  error: string | null;
  start: () => Promise<void>;
  /** Resolves with the finished recording. */
  stop: () => Promise<Blob | null>;
  reset: () => void;
}

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickMimeType(): string | undefined {
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

export function useAudioRecorder(): AudioRecorderState {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const teardown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    analyserRef.current = null;
    recorderRef.current = null;
    setLevel(0);
  }, []);

  // Unmount safety net: never leave the mic open.
  useEffect(() => teardown, [teardown]);

  const start = useCallback(async () => {
    setError(null);
    setElapsed(0);
    chunksRef.current = [];
    setStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // Level meter: sample the time-domain signal each animation frame.
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      const samples = new Uint8Array(analyser.fftSize);

      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) {
          const centered = (s - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / samples.length);
        setLevel((prev) => prev * 0.7 + Math.min(1, rms * 3) * 0.3);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000); // gather data in 1s chunks

      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      setStatus("recording");
    } catch (err) {
      teardown();
      setStatus("error");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access was denied. Enable it in your browser settings."
          : "Could not start recording.",
      );
    }
  }, [teardown]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return null;

    const mimeType = recorder.mimeType;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const out = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = []; // drop buffered audio immediately
        resolve(out);
      };
      recorder.stop();
    });

    teardown();
    setStatus("stopped");
    return blob;
  }, [teardown]);

  const reset = useCallback(() => {
    teardown();
    chunksRef.current = [];
    setElapsed(0);
    setError(null);
    setStatus("idle");
  }, [teardown]);

  return { status, elapsed, level, analyserRef, error, start, stop, reset };
}
