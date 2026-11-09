const CACHE_NAME = "lumi-shell-v4";

// Do not let an optional/offline cache failure prevent the service worker
// from installing. The previous cache.addAll() included a missing manifest
// URL, which rejected the whole install and made the admin PWA non-installable.
self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("lumi-shell-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        return response;
      }).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return (await caches.match(url.pathname.startsWith("/admin") ? "/admin/" : "/")) || Response.error();
      })
    );
  }
});

self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "Your Lumi daily update is ready." };
  }
  const title = payload.title || "Lumi · Daily update";
  const options = {
    body: payload.body || "Your daily fertility report is ready. Open Lumi to read it.",
    icon: payload.icon || "/icons/lumi.svg",
    badge: payload.badge || "/icons/lumi.svg",
    tag: payload.tag || "lumi-daily-update",
    renotify: false,
    data: payload.data || { url: "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.navigate(destination);
        return client.focus();
      }
    }
    return self.clients.openWindow(destination);
  })());
});
