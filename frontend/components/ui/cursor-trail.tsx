"use client";

/**
 * The flowing cursor trail, made global. Renders the single `#canvas` the
 * vendored effect draws into (fixed, full-viewport, behind content) and
 * starts it on mount. Placed in the workspace shell + auth screens so the
 * violet ribbon follows the pointer on every page.
 *
 * Desktop only — see `useFinePointer`. On phones and tablets nothing mounts,
 * so the canvas, its touch listeners, and the animation loop never exist.
 */

import { useEffect } from "react";
import { renderCanvas } from "@/components/ui/canvas";
import { useFinePointer } from "@/hooks/use-fine-pointer";

export function CursorTrail() {
  const finePointer = useFinePointer();

  useEffect(() => {
    if (!finePointer) return;
    renderCanvas();
  }, [finePointer]);

  if (!finePointer) return null;

  return (
    <canvas
      id="canvas"
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-[1] h-full w-full"
    />
  );
}
