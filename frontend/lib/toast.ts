/**
 * Tiny global toast store (no provider needed). Any client component can call
 * `toast.success(...)` etc.; the <Toaster /> mounted in the root layout
 * subscribes and renders. Auto-dismisses after a few seconds.
 */

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** When the toast was raised (epoch ms) — shown as a timestamp. */
  createdAt: number;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
let counter = 0;

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(variant: ToastVariant, title: string, description?: string) {
  const id = ++counter;
  // Persistent by design: notifications stay until the user dismisses them
  // (X button or swipe) — no auto-timeout.
  toasts = [...toasts, { id, title, description, variant, createdAt: Date.now() }];
  emit();
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export const toast = {
  success: (title: string, description?: string) => push("success", title, description),
  error: (title: string, description?: string) => push("error", title, description),
  info: (title: string, description?: string) => push("info", title, description),
};
