/**
 * Aura service worker — receives Web Push reminders when the app isn't open.
 *
 * The browser runs this independently of any tab, which is what makes
 * background appointment reminders possible. It does nothing else: no caching,
 * no offline shell, no interception of clinical requests.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
