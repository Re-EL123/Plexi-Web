// ============================================================
// PLEXI DIGITAL MALL — Service Worker
// Handles: caching, offline support, push notifications
// ============================================================

const CACHE_NAME = 'plexi-mall-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './signup.html',
  './manifest.json',
  './assets/css/variables.css',
  './assets/css/base.css',
  './assets/css/neomorphism.css',
  './assets/css/components.css',
  './assets/css/animations.css',
  './assets/js/config.js',
  './assets/js/ui.js',
  './assets/js/api.js',
  './assets/js/auth.js',
  './assets/js/state.js',
  './assets/js/sounds.js',
  './assets/js/dashboard.js',
  './assets/js/map.js',
  './assets/icons/logo.jpg'
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW: Some assets failed to cache', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and API requests
  if (request.method !== 'GET') return;
  if (request.url.includes('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(request).then((cached) => {
          return cached || caches.match('./index.html');
        });
      })
  );
});

// Push — handle push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Plexi Mall', body: 'You have a new notification', icon: './assets/icons/logo.jpg' };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (_) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || './assets/icons/logo.jpg',
    badge: './assets/icons/logo.jpg',
    vibrate: [100, 50, 100],
    data: data.url || './index.html',
    actions: data.actions || [],
    tag: data.tag || 'plexi-notification',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data || './index.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
