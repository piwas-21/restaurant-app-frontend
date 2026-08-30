/*
 * Deliberately dumb service worker.
 *
 * Its ONLY job is to satisfy the install criteria (a registered worker with a real fetch handler)
 * and to stay out of the way of a LIVE restaurant. It caches nothing, ever: an app that takes
 * orders and payments must not serve a stale page, and offline support is a separate, bigger
 * decision (see the PR body).
 *
 * The fetch handler is scoped as narrowly as it can be while still being a real handler:
 *   - GET only          → an order POST, a login, a payment is never routed through here.
 *   - navigations only  → /api/* proxy routes, XHR/fetch calls and static assets are untouched.
 *   - network only      → no cache reads, no cache writes, no offline fallback.
 *
 * Killswitch: post `{ type: 'UNREGISTER' }` to the worker, or load any page with `?pwa=off`
 * (handled in ServiceWorkerRegistrar.tsx), and it unregisters itself and drops any cache storage.
 */

const SW_VERSION = 'v1-passthrough';

self.addEventListener('install', () => {
  // No precache, so there is nothing to wait for.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Defensive: if a future version ever DID cache, activating this one clears it.
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'UNREGISTER') return;
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.mode !== 'navigate') return;
  // Network only. Failing here fails exactly as it would with no worker installed.
  event.respondWith(fetch(request));
});

// Referenced so the version string is not dead code a bundler/linter would strip.
self.addEventListener('activate', () => {
  console.info(`[sw] active ${SW_VERSION}`);
});
