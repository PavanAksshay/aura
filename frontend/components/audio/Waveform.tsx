"use client";

/**
 * Real-time Canvas sound-wave visualizer. While recording it renders live
 * frequency bars (mirrored around the midline) straight from the WebAudio
 * AnalyserNode; when idle it breathes a gentle sine ripple so the recorder
 * always feels alive. Drawing happens in one rAF loop on a single canvas —
 * no per-bar DOM nodes, no layout work.
 */

import { useEffect, useRef, type RefObject } from "react";

const BAR_COUNT = 56;
const IDLE_HEIGHT = 0.05;

function brandColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

export function Waveform({
  analyserRef,
  active,
}: {
  analyserRef: RefObject<AnalyserNode | null>;
  active: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth * dpr;
    const height = canvas.clientHeight * dpr;
    canvas.width = width;
    canvas.height = height;

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, brandColor("--aurora-teal", "#0d9488"));
    gradient.addColorStop(0.55, brandColor("--aurora-cyan", "#0e7490"));
    gradient.addColorStop(1, brandColor("--aurora-violet", "#7c3aed"));
    ctx.fillStyle = gradient;

    let bins: Uint8Array<ArrayBuffer> | null = null;
    // Smoothed per-bar values so the wave decays instead of snapping.
    const levels = new Float32Array(BAR_COUNT).fill(IDLE_HEIGHT);
    let raf = 0;

    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, width, height);

      const analyser = activeRef.current ? analyserRef.current : null;
      if (analyser) {
        if (!bins || bins.length !== analyser.frequencyBinCount) {
          bins = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(bins);
      }

      const slot = width / BAR_COUNT;
      const barWidth = slot * 0.55;
      const radius = barWidth / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        let target = IDLE_HEIGHT + Math.sin(time / 900 + i * 0.45) * 0.02;
        if (analyser && bins) {
          // Voice lives in the low bins; spread the first ~70% across bars.
          const bin = Math.floor((i / BAR_COUNT) * bins.length * 0.7);
          target = Math.max(target, ((bins[bin] ?? 0) / 255) * 0.95);
        }
        // Fast attack, slow release.
        levels[i] =
          target > (levels[i] ?? 0)
            ? target
            : (levels[i] ?? 0) * 0.88 + target * 0.12;

        const barHeight = Math.max((levels[i] ?? 0) * height, barWidth);
        const x = i * slot + (slot - barWidth) / 2;
        const y = (height - barHeight) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="h-20 w-full max-w-sm"
    />
  );
}
