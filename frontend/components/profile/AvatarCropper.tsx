"use client";

/**
 * A WhatsApp/Instagram-style photo adjuster. Shows the image in a square frame
 * the user can drag to reposition and zoom (slider, wheel, or pinch); on save
 * it renders just the framed region to a square canvas and returns a JPEG blob.
 *
 * The `src` must be a same-origin object URL (from a File, or from an existing
 * photo fetched to a blob) — a cross-origin <img> would taint the canvas and
 * make toBlob throw.
 */

import {
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
  type TouchEvent as ReactTouchEvent,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { Loader2, X, ZoomIn } from "lucide-react";

import { Button } from "@/components/ui/button";

const OUTPUT = 512; // exported square size, px
const MAX_ZOOM = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function AvatarCropper({
  src,
  onCancel,
  onSave,
}: {
  src: string;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void> | void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  // Mirrors of state read inside the ResizeObserver callback (which closes over
  // mount-time values otherwise).
  const natRef = useRef<{ w: number; h: number } | null>(null);
  const zoomRef = useRef(1);

  const [frame, setFrame] = useState(272); // measured square size, px
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1); // multiplier ≥ 1
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // image top-left in frame
  const [saving, setSaving] = useState(false);

  // Displayed image geometry for the current frame + zoom.
  const scale = nat ? (frame / Math.min(nat.w, nat.h)) * zoom : 1;
  const dw = nat ? nat.w * scale : frame;
  const dh = nat ? nat.h * scale : frame;

  const clampXY = (x: number, y: number, w: number, h: number, f: number) => ({
    x: clamp(x, f - w, 0),
    y: clamp(y, f - h, 0),
  });

  // Track the real rendered frame size so the crop math matches what's shown.
  // The observer callback is the allowed place to setState from (an external
  // system pushing updates), not the effect body itself.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const f = el.clientWidth;
      setFrame(f);
      const n = natRef.current;
      if (n) {
        const s = (f / Math.min(n.w, n.h)) * zoomRef.current;
        setOffset((o) => clampXY(o.x, o.y, n.w * s, n.h * s, f));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** First fit: cover the frame and centre. Done in the load event, not an effect. */
  function onImgLoad(e: SyntheticEvent<HTMLImageElement>) {
    const w = e.currentTarget.naturalWidth;
    const h = e.currentTarget.naturalHeight;
    const f = frameRef.current?.clientWidth ?? frame;
    const s = f / Math.min(w, h);
    natRef.current = { w, h };
    zoomRef.current = 1;
    setNat({ w, h });
    setFrame(f);
    setZoom(1);
    setOffset({ x: (f - w * s) / 2, y: (f - h * s) / 2 });
  }

  /** Zoom, keeping the image covering the frame (clamps the offset with it). */
  function applyZoom(next: number) {
    const z = clamp(next, 1, MAX_ZOOM);
    zoomRef.current = z;
    setZoom(z);
    if (nat) {
      const s = (frame / Math.min(nat.w, nat.h)) * z;
      setOffset((o) => clampXY(o.x, o.y, nat.w * s, nat.h * s, frame));
    }
  }

  function onPointerDown(e: ReactPointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.px);
    const ny = drag.current.oy + (e.clientY - drag.current.py);
    setOffset(clampXY(nx, ny, dw, dh, frame));
  }
  function onPointerUp() {
    drag.current = null;
  }

  // Two-finger pinch to zoom on touch.
  function onTouchMove(e: ReactTouchEvent) {
    const a = e.touches[0];
    const b = e.touches[1];
    if (!a || !b) return;
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (!pinch.current) {
      pinch.current = { dist, zoom };
      return;
    }
    applyZoom(pinch.current.zoom * (dist / pinch.current.dist));
  }
  function onTouchEnd(e: ReactTouchEvent) {
    if (e.touches.length < 2) pinch.current = null;
  }

  function onWheel(e: ReactWheelEvent) {
    applyZoom(zoom - e.deltaY * 0.0015);
  }

  async function save() {
    if (!nat || !imgRef.current) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      // The frame, expressed in the source image's own pixels.
      const sSize = frame / scale;
      ctx.drawImage(
        imgRef.current,
        -offset.x / scale,
        -offset.y / scale,
        sSize,
        sSize,
        0,
        0,
        OUTPUT,
        OUTPUT,
      );
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", 0.9),
      );
      if (blob) await onSave(blob);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass w-[min(24rem,calc(100vw-2rem))] rounded-3xl border border-border/60 p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-base font-semibold tracking-tight">
            Adjust photo
          </p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground transition hover:bg-foreground/8 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onWheel={onWheel}
          className="relative mx-auto aspect-square w-full max-w-[18rem] cursor-grab touch-none select-none overflow-hidden rounded-3xl bg-foreground/10 active:cursor-grabbing"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt="Adjust"
            draggable={false}
            onLoad={onImgLoad}
            className="pointer-events-none absolute max-w-none origin-top-left"
            style={{ left: offset.x, top: offset.y, width: dw, height: dh }}
          />
          <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/25" />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => applyZoom(parseFloat(e.target.value))}
            aria-label="Zoom"
            className="h-1.5 w-full cursor-pointer accent-primary"
          />
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Drag to reposition · pinch or use the slider to zoom
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !nat}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Save photo
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
