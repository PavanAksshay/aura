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
  return null;
}
