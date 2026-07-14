/* AlixWork Kalender – Web-Push Service Worker.
   Handles background push notifications only; does NOT cache app shell. */
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {
    try { data = { title: 'AlixWork Kalender', body: event.data ? event.data.text() : '' }; } catch (_) { data = {}; }
  }
  const title = data.title || 'AlixWork Kalender';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'alixwork-kalender',
    data: { url: data.url || '/m/kalender', reminderId: data.reminderId || null, eventId: data.eventId || null },
    requireInteraction: !!data.requireInteraction,
    vibrate: data.vibrate || [200, 100, 200],
    actions: data.actions || [
      { action: 'open', title: 'Öffnen' },
      { action: 'snooze', title: 'In 5 min erinnern' },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = event.action === 'snooze'
    ? `/m/kalender/erinnerungen?snooze=${encodeURIComponent(data.reminderId || '')}`
    : (data.url || '/m/kalender');
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes('/m/kalender')) {
        await c.focus();
        try { c.postMessage({ type: 'kalender-nav', url }); } catch (_) {}
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
