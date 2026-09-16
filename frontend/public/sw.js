/* Service worker: the part of the app that is awake when the tab is not.

   Two jobs. Draw the reminder and put the user where the task is when they
   tap it; and keep enough of the app cached that opening it on a train shows
   the last data instead of a browser error page. */

const SHELL = 'jc-shell-v1';     // the page and its hashed assets
const DATA  = 'jc-data-v1';      // the last successful answer from each GET

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Drop caches from an older version of this file rather than leaving them
    // to hold a stale app for ever.
    for (const key of await caches.keys()) {
      if (key !== SHELL && key !== DATA) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

/* Network first, cache as a fallback. Fresh whenever there is a connection,
   and the last known answer when there is not.
   ponytail: reads only. A write made offline fails and is the user's to
   retry - a replay queue needs conflict rules this app has not earned yet. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // A navigation always resolves to the same single-page shell.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL).catch(() => caches.match('/')));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, DATA));
    return;
  }

  /* Cache-first only for /assets/, because only those filenames carry a
     content hash - a hashed URL in the cache is the right answer for ever.
     Everything else (dev modules, HMR, the icon) stays network-first, or a
     stale module would survive the next edit. */
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const hit = await cache.match(request);
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok) cache.put(request, res.clone());
      return res;
    })());
    return;
  }

  event.respondWith(networkFirst(request, SHELL));
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* keep the defaults */ }

  event.waitUntil(self.registration.showNotification(data.title || 'JC Command Center', {
    body: data.body || '',
    // A tag per task means a second reminder replaces the first rather than
    // stacking another card on the lock screen.
    tag: data.tag || 'jc-reminder',
    renotify: false,
    data: { url: data.url || '/todo' },
    badge: '/favicon.svg',
    icon: '/favicon.svg'
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/todo';
  event.waitUntil((async () => {
    const tabs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reuse a tab that is already open rather than piling up windows.
    for (const tab of tabs) {
      if (tab.url.includes(self.location.origin)) {
        await tab.focus();
        return tab.navigate ? tab.navigate(target) : undefined;
      }
    }
    return clients.openWindow(target);
  })());
});
