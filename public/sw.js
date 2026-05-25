// Service worker for Revisare — handles background Web Push notifications.
// This file is served from the root (public/sw.js) and must NOT be bundled.

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const options = {
    body: data.body ?? "",
    icon: "/icon-512.png",
    badge: "/icon-180.png",
    vibrate: [200, 100, 200],
    data: { href: data.href ?? "/" },
  };
  // Only add tag/renotify when explicitly provided (prevents collapse without intent)
  if (data.tag) {
    options.tag = data.tag;
    options.renotify = true;
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Revisare", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(href);
            return;
          }
        }
        clients.openWindow(href);
      })
  );
});
