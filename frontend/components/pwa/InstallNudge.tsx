"use client";

/**
 * A one-time, dismissible nudge shown to a freshly-registered clinician,
 * suggesting they install Aura as an app. It does not install anything itself
 * — the real install button (and the iOS instructions) live on the profile,
 * so this only points there. Installing is entirely the user's choice.
 *
 * Trigger: onboarding sets INSTALL_NUDGE_KEY to "pending" just before
 * redirecting to the dashboard, so only a new registration ever sees this;
 * existing users never had the flag set. It shows once and any interaction
 * clears the flag, so it never nags. It also suppresses itself if the app is
 * already installed, or if the user is already on the profile page.
 */

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { INSTALL_NUDGE_KEY } from "@/lib/pwa-install";
import { AuraMark } from "@/components/ui/aura-logo";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/components/motion/primitives";

function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS marks an installed PWA with this non-standard flag.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function clearFlag() {
  try {
    localStorage.removeItem(INSTALL_NUDGE_KEY);
  } catch {
    // ignore
  }
}

export function InstallNudge() {
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Async so the setState is scheduled, not called synchronously inside the
    // effect (which the react-hooks rule flags as cascade-prone).
    void (async () => {
      let pending = false;
      try {
        pending = localStorage.getItem(INSTALL_NUDGE_KEY) === "pending";
      } catch {
        // Private mode / storage disabled — simply never nudge.
      }
      if (cancelled || !pending) return;
      // Nothing to suggest if they are already running the installed app.
      if (isInstalled()) {
        clearFlag();
        return;
      }
      setShow(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    clearFlag();
    setShow(false);
  }

  function openProfile() {
    dismiss();
    router.push("/profile");
  }

  // They are already where the real install control lives.
  if (pathname === "/profile") return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="dialog"
          aria-label="Install the Aura app"
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          className="fixed bottom-4 left-1/2 z-[90] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 sm:left-4 sm:translate-x-0"
        >
          <div className="glass relative rounded-2xl border border-border/60 p-4 shadow-xl">
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute right-2.5 top-2.5 rounded-md p-1 text-muted-foreground transition hover:bg-foreground/8 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12">
                <AuraMark className="size-5" />
              </span>
              <div className="min-w-0 pr-4">
                <p className="text-sm font-medium">Get the full Aura experience</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Install Aura as an app for faster access — anytime, from your
                  Profile.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" onClick={openProfile}>
                    Open Profile
                  </Button>
                  <Button size="sm" variant="ghost" onClick={dismiss}>
                    Not now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
