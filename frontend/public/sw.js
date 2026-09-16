/* Service worker: the part of the app that is awake when the tab is not.

   It does two things and nothing else - draw the notification, and put the
   user where the task is when they tap it. */

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
