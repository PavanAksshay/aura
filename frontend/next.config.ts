import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * `microphone=(self)` is required — Aura records audio in-browser.
 *
 * The CSP is built from the real backend origins at build time so
 * connect-src can be tight. Notes on the necessary loosenings:
 *  - script-src needs 'unsafe-inline' for Next's inline bootstrap, and
 *    'unsafe-eval' in dev only (HMR / React refresh use eval).
 *  - style-src needs 'unsafe-inline': Tailwind + framer-motion set inline styles.
 *  - blob: is needed for audio recording (MediaRecorder) and WebGL workers.
 * The high-value directives here are frame-ancestors, object-src, base-uri,
 * form-action, and the connect-src allowlist.
 */
const isDev = process.env.NODE_ENV !== "production";

const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").origin;
  } catch {
    return "http://localhost:8000";
  }
})();

const connectSrc = [
  "'self'",
  apiOrigin,
  supabaseOrigin,
  supabaseOrigin.replace(/^https:/, "wss:"),
  isDev ? "ws://localhost:*" : "",
]
  .filter(Boolean)
  .join(" ");

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), browsing-topics=(), microphone=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
