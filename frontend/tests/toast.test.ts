/**
 * Toast lifetimes.
 *
 * These exist because the rule is not obvious from reading a call site: whether
 * a notification disappears depends on its *consequence*, not its variant, and
 * a regression here is silent — a sticky toast that starts auto-dismissing
 * looks fine in dev and loses a clinician their "note ready" alert in practice.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  dismissToast,
  subscribeToasts,
  toast,
  TOAST_DURATION_MS,
  type ToastItem,
} from "../lib/toast.ts";

/** Snapshot the store and clear it, so tests don't leak into each other. */
function reset(): () => ToastItem[] {
  let current: ToastItem[] = [];
  subscribeToasts((t) => {
    current = t;
  });
  for (const item of [...current]) dismissToast(item.id);
  return () => current;
}

const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("routine confirmations disappear on their own", async () => {
  const get = reset();
  toast.success("Note copied");
  assert.equal(get().length, 1);
  assert.equal(get()[0].sticky, false);

  await settle(TOAST_DURATION_MS + 200);
  assert.equal(get().length, 0, "transient toast should have expired");
});

test("errors stay until dismissed, without opting in", async () => {
  const get = reset();
  toast.error("Upload failed");
  assert.equal(get()[0].sticky, true);

  await settle(TOAST_DURATION_MS + 200);
  assert.equal(get().length, 1, "an error must not vanish unnoticed");
  dismissToast(get()[0].id);
  assert.equal(get().length, 0);
});

test("pipeline notices can opt into sticky", async () => {
  const get = reset();
  toast.success("Session note ready", "transcribed", { sticky: true });
  await settle(TOAST_DURATION_MS + 200);
  assert.equal(get().length, 1, "note-ready lands minutes later; it must wait");
  dismissToast(get()[0].id);
});

test("an error can opt out of sticky", () => {
  const get = reset();
  toast.error("Minor hiccup", undefined, { sticky: false });
  assert.equal(get()[0].sticky, false);
  dismissToast(get()[0].id);
});

test("dismissing by hand cancels the pending timer", async () => {
  const get = reset();
  toast.success("Saved");
  const id = get()[0].id;
  dismissToast(id);
  assert.equal(get().length, 0);

  // Raise another toast that would reuse the slot, then let the first timer's
  // deadline pass. A leaked timer would fire against the stale id.
  toast.success("Another", undefined, { sticky: true });
  await settle(TOAST_DURATION_MS + 200);
  assert.equal(get().length, 1, "the surviving sticky toast must be untouched");
  dismissToast(get()[0].id);
});

test("several toasts expire independently", async () => {
  const get = reset();
  toast.success("First");
  toast.error("Failure");
  toast.info("Heads up", undefined, { sticky: true });
  assert.equal(get().length, 3);

  await settle(TOAST_DURATION_MS + 200);
  const titles = get().map((t) => t.title).sort();
  assert.deepEqual(titles, ["Failure", "Heads up"]);
  for (const item of [...get()]) dismissToast(item.id);
});
