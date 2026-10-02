// Push service worker: shows FCM messages sent by the API (apps/api/src/lib/push.ts).
self.addEventListener('push', (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    /* not JSON */
  }
  const n = msg.notification || {};
  const data = msg.data || {};
  event.waitUntil(
    self.registration.showNotification(n.title || 'Karaoke Scene', {
      body: n.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.kind,
      data: { link: data.link || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.link || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => w.url.startsWith(self.location.origin));
      if (win) return win.focus().then((w) => w.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
