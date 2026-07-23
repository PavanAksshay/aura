"use client";

/**
 * A persistent nudge, shown to every user who hasn't installed Aura yet,
 * suggesting they add it from their Profile. It installs nothing itself — the
 * real install button (and iOS instructions) live on the profile, so this only
 * points there.
 *
 * Behaviour:
 *  - Shows once per browsing session until the app is installed. It never
 *    auto-dismisses: it stays until the user taps it, swipes it away, or closes
 *    it, then hides for the rest of the session (so it doesn't nag on every
 *    navigation) and reminds again next session.
 *  - Tapping the card opens the Profile; swiping it sideways or pressing × just
 *    dismisses it.
 *  - Suppresses itself when already installed, or when already on /profile.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, type PanInfo } from "framer-motion";
import { X } from "lucide-react";

import { AuraMark } from "@/components/ui/aura-logo";

// Per-session so it reminds again next visit, but not on every page change.
const DISMISS_KEY = "aura-install-nudge-dismissed";
// Sideways travel (px) past which a swipe counts as "dismiss".
const SWIPE_THRESHOLD = 90;

function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS marks an installed PWA with this non-standard flag.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function InstallNudge() {
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  // True while a drag is in flight, so the click that trails a swipe doesn't
  // also navigate to the profile.
  const dragged = useRef(false);

  useEffect(() => {
    void (async () => {
      if (isInstalled()) return;
      let dismissed = false;
      try {
        dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        // Storage blocked (private mode) — showing it is the safe default.
      }
      if (!dismissed) setShow(true);
    })();
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  }

  function openProfile() {
    dismiss();
    router.push("/profile");
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
      dismiss();
      return;
    }
    // Snapped back — clear the flag on the next tick so a real tap still works.
    setTimeout(() => {
      dragged.current = false;
    }, 0);
  }

  // Already where the real install control lives, or nothing to show.
  if (!show || pathname === "/profile") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex justify-center px-4 sm:justify-start sm:pl-4">
      <motion.div
        drag="x"
        dragElastic={0.25}
        dragConstraints={{ left: 0, right: 0 }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={onDragEnd}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="pointer-events-auto w-[min(23rem,calc(100vw-2rem))] cursor-grab active:cursor-grabbing"
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Download the Aura app from your Profile"
          onClick={() => {
            if (dragged.current) {
              dragged.current = false;
              return;
            }
            openProfile();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openProfile();
            }
          }}
          className="glass relative cursor-pointer rounded-2xl border border-border/60 p-4 shadow-xl transition hover:border-primary/50"
        >
          <button
            type="button"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              dismiss();
            }}
            onPointerDownCapture={(e) => e.stopPropagation()}
            className="absolute right-2.5 top-2.5 rounded-md p-1 text-muted-foreground transition hover:bg-foreground/8 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12">
              <AuraMark className="size-5" />
            </span>
            <div className="min-w-0 pr-4">
              <p className="text-sm leading-relaxed">
                wait, before you continue, would you mind downloading me?? you
                wouldn&apos;t have to search for me everytime then
              </p>
              <p className="mt-2 text-xs font-medium text-primary">
                Tap to open your Profile →
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
