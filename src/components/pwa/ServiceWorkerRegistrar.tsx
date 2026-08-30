'use client';

import { useEffect } from 'react';

/** Query parameter that unregisters the worker and clears its caches — the manual killswitch. */
export const PWA_KILL_PARAM = 'pwa';
export const PWA_KILL_VALUE = 'off';

/**
 * Registers `/sw.js` (see public/sw.js — a pass-through worker that caches nothing).
 *
 * PRODUCTION ONLY: `next dev` serves modules that change on every keystroke, and a worker in front
 * of that is a debugging trap for no benefit. Staging runs a production build, so the worker is
 * exercised there before prod.
 *
 * Renders nothing.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const killswitchRequested = new URLSearchParams(window.location.search).get(PWA_KILL_PARAM) === PWA_KILL_VALUE;
    if (killswitchRequested) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => void registration.unregister());
      });
      return;
    }

    if (process.env.NODE_ENV !== 'production') return;

    // After `load`, so registration never competes with the first paint for bandwidth.
    const register = () => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
        // A failed registration must never break the page — the app works without a worker.
        console.warn('[pwa] service worker registration failed', error);
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
