"use client";

/**
 * "Install Aura" — a card on the profile that turns the site into an app.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt`, which we stash and replay on
 * click. iOS Safari has no such event: installing is a manual Share → "Add to
 * Home Screen", so there we show those steps instead of a dead button.
 */

import { useEffect, useState } from "react";
import { Check, Download, Share } from "lucide-react";

import {
  clearInstallPrompt,
  getInstallPrompt,
  subscribeInstall,
} from "@/lib/pwa-install";
import { Button } from "@/components/ui/button";

type Mode = "unavailable" | "prompt" | "ios" | "installed";

function detectMode(): Mode {
  if (typeof window === "undefined") return "unavailable";
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS marks installed PWAs with a non-standard flag.
    (window.navigator as { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";

  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as a Mac; a touch-capable "Mac" is really an iPad.
  const isIPadOS =
    /Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document;
  return isIOS || isIPadOS ? "ios" : "unavailable";
}

export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>("unavailable");

  useEffect(() => {
    // The prompt may already be parked from an earlier page load, so read it
    // now and then follow it.
    const sync = () =>
      setMode(getInstallPrompt() !== null ? "prompt" : detectMode());
    sync();
    return subscribeInstall(sync);
  }, []);

  async function install() {
    const deferred = getInstallPrompt();
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    clearInstallPrompt();
    if (outcome === "accepted") setMode("installed");
  }

  // Nothing useful to say on a desktop browser that can't install.
  if (mode === "unavailable") return null;

  return (
    <div className="glass rounded-3xl p-6">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Install Aura
      </h2>

      {mode === "installed" ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="size-4 text-primary" />
          Installed — you&apos;re running Aura as an app.
        </p>
      ) : mode === "ios" ? (
        <>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Add Aura to your home screen to open it like an app, full screen and
            without browser chrome.
          </p>
          <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                1
              </span>
              Tap the Share icon
              <Share className="size-3.5" />
              in Safari&apos;s toolbar
            </li>
            <li className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                2
              </span>
              Choose “Add to Home Screen”
            </li>
            <li className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                3
              </span>
              Tap “Add”
            </li>
          </ol>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Install Aura to launch it from your dock or home screen, in its own
            window.
          </p>
          <Button size="sm" className="mt-4" onClick={install}>
            <Download />
            Install app
          </Button>
        </>
      )}
    </div>
  );
}
