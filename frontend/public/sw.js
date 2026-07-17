/**
 * Aura service worker.
 *
 * Two jobs, both deliberately narrow:
 *  1. Receive Web Push reminders when the app isn't open (the browser runs
 *     this independently of any tab).
 *  2. Serve an offline page when a navigation fails, which also satisfies the
 *     fetch-handler requirement for installability.
 *
 * It caches NOTHING but the static offline shell. This is a clinical app:
 * pages and API responses carry patient data, so putting them in the Cache
 * API would write PHI to disk with no lifecycle. Every real request goes
 * straight to the network, untouched.
 */

const SHELL_CACHE = "aura-shell-v1";
const OFFLINE_URL = "/offline.html";
const SHELL_ASSETS = [OFFLINE_URL, "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older shell versions.
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== SHELL_CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only page navigations are handled — and only to fall back when offline.
  // Everything else (API calls, Supabase, assets) is left entirely alone.
  if (request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return (
          offline ??
          new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
        );
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Aura";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "aura-reminder",
    renotify: true,
    // Reminders matter — don't let them auto-dismiss.
    requireInteraction: true,
    data: { url: data.url || "/schedule" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/schedule";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
