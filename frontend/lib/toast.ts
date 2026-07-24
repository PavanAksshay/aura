/**
 * Tiny global toast store (no provider needed). Any client component can call
 * `toast.success(...)` etc.; the <Toaster /> mounted in the root layout
 * subscribes and renders.
 *
 * Two lifetimes, chosen by consequence rather than by variant:
 *
 *  - **Transient (6s)** for actions the user just performed and already watched
 *    succeed — copied, saved, marked reviewed, photo updated. A confirmation
 *    you must dismiss by hand is friction, and a stack of stale confirmations
 *    trains people to swipe everything away unread, which is precisely how the
 *    one that mattered gets missed.
 *
 *  - **Sticky** for anything the user must not miss: a long job finishing while
 *    they were on another tab ("your note is ready"), and every failure. These
 *    wait for an explicit dismiss — the X button or a swipe.
 *
 * Errors are sticky by default. A failure that quietly vanishes after six
 * seconds while the clinician is looking at their patient is a failure they
 * never learn about.
 */

export type ToastVariant = "success" | "error" | "info";

/** How long a transient toast stays up before dismissing itself. */
export const TOAST_DURATION_MS = 6000;

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** When the toast was raised (epoch ms) — shown as a timestamp. */
  createdAt: number;
  /** Sticky toasts wait for the user; transient ones expire on their own. */
  sticky: boolean;
  /** If set, tapping the toast navigates here (and dismisses it). */
  href?: string;
  /** The tap affordance shown when `href` is set, e.g. "Open Profile →". */
  actionLabel?: string;
  /** De-dupe tag: a second toast with the same key is ignored while one is up. */
  key?: string;
}

interface ToastOptions {
  /** Force the toast to wait for an explicit dismiss. */
  sticky?: boolean;
  href?: string;
  actionLabel?: string;
  key?: string;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let counter = 0;

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function dismissToast(id: number) {
  // Clear the pending timer too, or a hand-dismissed toast leaves a callback
  // that fires later against an id that no longer exists.
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(
  variant: ToastVariant,
  title: string,
  description?: string,
  options?: ToastOptions,
): number {
  // De-dupe: while a keyed toast is already up, don't stack another (e.g. the
  // install nudge firing again on a fast remount).
  if (options?.key) {
    const existing = toasts.find((t) => t.key === options.key);
    if (existing) return existing.id;
  }

  const id = ++counter;
  const sticky = options?.sticky ?? variant === "error";
  toasts = [
    ...toasts,
    {
      id,
      title,
      description,
      variant,
      createdAt: Date.now(),
      sticky,
      href: options?.href,
      actionLabel: options?.actionLabel,
      key: options?.key,
    },
  ];
  emit();

  if (!sticky) {
    timers.set(
      id,
      setTimeout(() => dismissToast(id), TOAST_DURATION_MS),
    );
  }
  return id;
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export const toast = {
  /** Transient by default — the user just did this and watched it happen. */
  success: (title: string, description?: string, options?: ToastOptions) =>
    push("success", title, description, options),
  /** Sticky by default — a failure must not disappear unnoticed. */
  error: (title: string, description?: string, options?: ToastOptions) =>
    push("error", title, description, options),
  info: (title: string, description?: string, options?: ToastOptions) =>
    push("info", title, description, options),
};
