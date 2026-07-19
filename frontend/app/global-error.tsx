"use client";

/**
 * Last line of defence: catches failures in the root layout itself, which the
 * route-level error.tsx cannot. Next.js replaces the entire document here, so
 * this file must render its own <html>/<body> and cannot rely on the app's
 * providers, fonts, or Tailwind layer being available — hence inline styles.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Aura fatal error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#f4f7f5",
          color: "#14201a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <main style={{ maxWidth: "34rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem" }}>
            Aura is temporarily unavailable
          </h1>
          <p style={{ lineHeight: 1.6, margin: "0 0 1.5rem", opacity: 0.8 }}>
            We hit an unexpected problem loading the app. Your patients, notes
            and recordings are stored safely and have not been affected —
            reloading usually resolves it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: "none",
              borderRadius: "9999px",
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              fontWeight: 500,
              cursor: "pointer",
              background: "#1f6f5c",
              color: "#fff",
            }}
          >
            Reload Aura
          </button>
          {error.digest && (
            <p style={{ marginTop: "1.5rem", fontSize: "0.8rem", opacity: 0.6 }}>
              Reference: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
