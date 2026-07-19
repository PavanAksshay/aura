"use client";

/**
 * Route-level error boundary. Next.js renders this instead of unmounting the
 * tree when a page or its data throws, so a failure in one tab never blanks
 * the whole app — the nav and every other route stay usable.
 *
 * Wording matters here more than usual: in a clinical tool an unexplained
 * error screen reads as "my patient notes are gone". They are not; nothing is
 * written client-side, so the copy says so plainly.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No error-reporting service is wired up; the console is the only record.
    console.error("Aura route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-4 text-center">
      <div className="glass flex w-full flex-col items-center gap-4 rounded-3xl px-6 py-10">
        <AlertTriangle aria-hidden className="size-8 text-amber-500" />
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Sorry for the inconvenience caused. App is down for maintenance.
          Please try again later
        </h1>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground transition hover:opacity-90"
          >
            <RefreshCw aria-hidden className="size-4" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-full border border-border px-5 py-2.5 font-medium transition hover:bg-muted/50"
          >
            Back to dashboard
          </Link>
        </div>

        {error.digest && (
          <p className="mt-2 text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
