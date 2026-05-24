// Service worker for Revisare — handles background Web Push notifications.
// This file is served from the root (public/sw.js) and must NOT be bundled.

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Revisare", {
      body: data.body ?? "",
      icon: "/icon-512.png",
      badge: "/icon-180.png",
      data: { href: data.href ?? "/" },
    })
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
