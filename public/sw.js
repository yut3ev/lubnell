/* LUBNÉL Web Push service worker (PUSH-2026-10)
   - push event → branded notification (icon/badge from /brand, brand colors)
   - notificationclick → focus an existing tab or open the target URL
   - deliberately minimal: no offline caching, no background sync */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'LUBNÉL', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'LUBNÉL';
  const options = {
    body: data.body || '',
    icon: data.icon || '/brand/logo-dark.png',
    badge: data.badge || '/brand/logo-dark.png',
    dir: 'rtl',
    lang: 'ar',
    tag: data.tag || 'lubnel-push', // replaces older duplicates instead of stacking
    vibrate: [80, 40, 80],
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // focus an already-open tab on the same origin (any path), else open fresh
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
