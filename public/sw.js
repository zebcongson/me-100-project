// Service worker: receives pushes while the app is closed and keeps an alert history.
const DB = 'ulock';
const STORE = 'alerts';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addAlert(alert) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(alert);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { message: event.data ? event.data.text() : '' };
  }
  const level = data.level || 'HIGH';
  const message = data.message || 'Movement detected';
  const title = data.title || 'U-lock alarm';
  const alert = { level, message, ts: Date.now() };

  event.waitUntil((async () => {
    try { await addAlert(alert); } catch (err) { /* history is best effort */ }
    // iPhones require every push to show a notification.
    await self.registration.showNotification(title, {
      body: level + ': ' + message,
      tag: 'ulock-alarm',
      renotify: true,
    });
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    open.forEach((client) => client.postMessage({ type: 'alert', level, message }));
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (open.length) return open[0].focus();
    return self.clients.openWindow('/');
  })());
});
