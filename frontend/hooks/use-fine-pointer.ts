"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * True only on devices driven by a real pointer — a mouse or trackpad.
 *
 * Gates the decorative cursor effects. They have no meaning without a hovering
 * cursor: on a phone the canvas trail binds `touchstart`/`touchmove`, so the
 * ribbon chases taps and scrolls instead of following anything, while still
 * paying for a full-viewport canvas and a permanent rAF loop on battery.
 *
 * `(hover: hover) and (pointer: fine)` is the capability test rather than a
 * width breakpoint: it correctly excludes a large tablet and correctly
 * includes a small laptop window. It is also live — a tablet gaining a
 * keyboard case re-evaluates without a reload.
 *
 * `useSyncExternalStore` rather than state-in-an-effect: a media query is
 * exactly the external store it exists for. The server snapshot is false, so
 * touch devices and SSR never render the effect at all; a desktop picks it up
 * on hydration, which is imperceptible for decoration.
 */
const QUERY = "(hover: hover) and (pointer: fine)";

export function useFinePointer(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const query = window.matchMedia(QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
