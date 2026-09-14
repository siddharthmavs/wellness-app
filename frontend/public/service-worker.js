/* Wellness Garden service worker — Web Push only (doc section 8.4).
   No asset caching / offline support is attempted here on purpose. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Wellness Garden", message: "Time for a wellness break." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) {
    // non-JSON payload, fall back to defaults
  }

  const { title, message, data } = payload;
  event.waitUntil(
    self.registration.showNotification(title || "Wellness Garden", {
      body: message || "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: data || {},
      tag: (data && data.type) || undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
