/**
 * VPSGUI Open Infrastructure Workspace Service Worker
 *
 * Caches the static app shell for offline loads. API responses are deliberately NEVER cached:
 * they carry live host telemetry, process lists, and file contents, and serving a stale copy would
 * both leak that data into persistent browser storage and present old readings as current.
 */

const CACHE_NAME = 'vpsgui-cache-v2';

// Only assets that are guaranteed to exist. cache.addAll() rejects atomically if any single entry
// 404s, which previously aborted installation entirely (the list referenced /manifest.json, which
// this project does not ship) and left the service worker permanently inactive.
const STATIC_ASSETS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Cache entries individually so one missing asset cannot fail the whole install.
        Promise.all(
          STATIC_ASSETS.map((asset) =>
            cache.add(asset).catch((err) => console.warn('[SW] Skipped caching', asset, err))
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only same-origin GETs are eligible; cross-origin requests (fonts, ipapi.co) pass through.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Never cache, never serve from cache: privileged host data must always come from the agent.
  // A cached telemetry or file-read response would otherwise persist on disk and could be replayed
  // after logout or by anyone with local access to the profile.
  if (url.pathname.startsWith('/api/')) return;

  // Stale-while-revalidate for the app shell and build assets.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // Only store complete, same-origin basic responses; opaque ones poison the cache.
          if (networkResponse.ok && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    event.waitUntil(
      self.registration.showNotification(payload.title || 'VPSGUI Alert', {
        body: payload.body || 'Infrastructure alert received',
        data: payload.data || {},
        // icon/badge are omitted rather than pointing at /icon-192.png and /badge.png, which this
        // project does not ship; a missing icon path makes some browsers drop the notification.
        tag: payload.tag || 'vpsgui-alert',
      })
    );
  } catch (e) {
    console.error('Service Worker push parse error:', e);
  }
});
