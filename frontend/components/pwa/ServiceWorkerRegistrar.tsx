"use client";

/**
 * Registers the service worker on load, and starts listening for the install
 * prompt. Both belong at the root: push enrolment also registers the worker,
 * but installability needs it for everyone, and `beforeinstallprompt` fires
 * on the first page loaded — long before the profile's install button mounts.
 */

import { useEffect } from "react";

import { attachInstallCapture } from "@/lib/pwa-install";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    attachInstallCapture();

    if (!("serviceWorker" in navigator)) return;
    // Registration competes with hydration for the main thread; wait for idle.
    const id = window.setTimeout(() => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal: the app works fine without it — no install, no push.
      });
    }, 1200);
    return () => window.clearTimeout(id);
  }, []);

  return null;
}
