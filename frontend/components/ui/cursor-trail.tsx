"use client";

/**
 * The flowing cursor trail, made global. Renders the single `#canvas` the
 * vendored effect draws into (fixed, full-viewport, behind content) and
 * starts it on mount. Placed in the workspace shell + auth screens so the
 * violet ribbon follows the pointer on every page.
 */

import { useEffect } from "react";
import { renderCanvas } from "@/components/ui/canvas";

export function CursorTrail() {
  useEffect(() => {
    renderCanvas();
  }, []);

  return (
    <canvas
      id="canvas"
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-[1] h-full w-full"
    />
  );
}
