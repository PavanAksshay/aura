"use client";

/**
 * Nudges every user who hasn't installed Aura to add it from their Profile —
 * delivered as a sticky toast (same bottom-right notification style as the
 * reminder confirmation: timestamped, survives scrolling, dismissed only by a
 * swipe or the × — never on a timer). Tapping it opens the Profile.
 *
 * It renders nothing itself; it just raises the toast once per visit. Because
 * the workspace layout stays mounted across in-app navigation, it won't re-nag
 * as the user moves around — but a full reload or the next login raises it
 * again. Suppressed when the app is already installed, or on /profile (where
 * the real install control lives). A de-dupe key stops it stacking.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { dismissToast, toast } from "@/lib/toast";

const NUDGE_KEY = "install-nudge";

function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS marks an installed PWA with this non-standard flag.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function InstallNudge() {
  const pathname = usePathname();
  const toastId = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Deferred past an await so the store update isn't synchronous in the
      // effect body (which the react-hooks rule flags).
      await Promise.resolve();
      if (cancelled || isInstalled() || pathname === "/profile") return;
      toastId.current = toast.info(
        "A note from Aura 🕊️",
        "wait, before you continue, would you mind downloading me?? you wouldn't have to search for me everytime then",
        {
          sticky: true,
          href: "/profile",
          actionLabel: "Tap to open your Profile →",
          key: NUDGE_KEY,
        },
      );
    })();
    return () => {
      cancelled = true;
    };
    // Fire once per mount; navigation is handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once they reach the profile, the nudge has done its job — clear it.
  useEffect(() => {
    if (pathname === "/profile" && toastId.current !== null) {
      dismissToast(toastId.current);
      toastId.current = null;
    }
  }, [pathname]);

  return null;
}
