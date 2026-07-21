/**
 * Holds the browser's install prompt.
 *
 * `beforeinstallprompt` fires once, early, on whatever page loaded first —
 * usually not the profile, where the install button lives. So the event is
 * captured app-wide (from the root layout) and parked here; the button reads
 * it whenever it happens to mount.
 */

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Set to "pending" the moment a user finishes registering (onboarding), read
 * once on the dashboard to show the install nudge, then cleared. Kept here so
 * the onboarding flow and the nudge component agree on the key without one
 * importing the other's component module.
 */
export const INSTALL_NUDGE_KEY = "aura-install-nudge";

let deferred: InstallPromptEvent | null = null;
let attached = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Start listening. Safe to call more than once. */
export function attachInstallCapture(): void {
  if (attached || typeof window === "undefined") return;
  attached = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    // Suppress the browser's own mini-infobar; Aura offers its own button.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

export function getInstallPrompt(): InstallPromptEvent | null {
  return deferred;
}

export function clearInstallPrompt(): void {
  deferred = null;
  emit();
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
