"use client";

/**
 * A persistent nudge, shown to every user who hasn't installed Aura yet,
 * suggesting they add it from their Profile. It installs nothing itself — the
 * real install button (and iOS instructions) live on the profile, so this only
 * points there.
 *
 * Behaviour:
 *  - Shows on each visit (page load / login) until the app is installed. It
 *    never auto-dismisses: it stays until the user taps it, swipes it away, or
 *    closes it. Dismissing hides it for the rest of that visit — the workspace
 *    layout stays mounted across in-app navigation, so it won't re-nag on every
 *    click — and a fresh load or the next login shows it again.
 *  - Tapping the card opens the Profile; swiping it sideways or pressing × just
 *    dismisses it.
 *  - Suppresses itself when already installed, or when already on /profile.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, type PanInfo } from "framer-motion";
import { X } from "lucide-react";

import { AuraMark } from "@/components/ui/aura-logo";

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
    let cancelled = false;
    void (async () => {
      // Deferred past an await so the setState isn't synchronous in the effect
      // body (which the react-hooks rule flags).
      await Promise.resolve();
      if (!cancelled && !isInstalled()) setShow(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    // In-memory only: the layout persists across in-app navigation so this
    // won't re-nag, but a full reload or a fresh login shows it again.
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
    <div className="pointer-events-none fixed right-0 top-1/2 z-[90] flex -translate-y-1/2 justify-end px-3 sm:px-4">
      <motion.div
        drag="x"
        dragElastic={0.25}
        dragConstraints={{ left: 0, right: 0 }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={onDragEnd}
        initial={{ opacity: 0, x: 64 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="pointer-events-auto w-[min(23rem,calc(100vw-1.5rem))] cursor-grab active:cursor-grabbing"
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
