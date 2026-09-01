'use client';

import { useCallback, useEffect, useState } from 'react';
import { isIosInstallable, isStandaloneDisplay } from '@/lib/pwa';

/** Chrome's non-standard install event. Not in lib.dom, so it is declared here rather than `any`. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** The event, parked here when Chrome fires it before React has mounted anything. */
declare global {
  interface Window {
    __pwaDeferredInstall?: BeforeInstallPromptEvent;
  }
}

// Registered at MODULE EVALUATION, not inside the hook, because on a repeat visit Chrome's
// service worker is already active and installability is already decided — the event can fire
// before React hydrates, and a listener that only exists after mount misses it permanently.
// preventDefault() stops Chrome's own mini-infobar so OUR entry point is the only offer.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.__pwaDeferredInstall = event as BeforeInstallPromptEvent;
  });
}

export type InstallPlatform = 'chromium' | 'ios' | 'unsupported';
export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

/**
 * State for a PERSISTENT install entry point (a nav item), not an auto-popup.
 *
 * The 2026-08-31 banner approach was retired by owner decision: popups race hydration, need
 * visit counting and suppression bookkeeping, and were unstable in the field. The industry
 * pattern (and this hook) is: capture `beforeinstallprompt` early, let a stable menu entry
 * call `prompt()` on click (Chromium), show short instructions on iOS (Apple exposes no
 * install API at all), and hide the entry once the app is installed.
 */
export function usePwaInstall() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window === 'undefined' ? null : (window.__pwaDeferredInstall ?? null),
  );
  const [standalone, setStandalone] = useState(() => (typeof window === 'undefined' ? false : isStandaloneDisplay()));

  useEffect(() => {
    // The module listener parks the event; this one only mirrors it into state. Re-read on
    // every firing — Chrome re-offers per page load, and the entry appears the moment it does.
    const sync = () => setDeferredEvent(window.__pwaDeferredInstall ?? null);
    window.addEventListener('beforeinstallprompt', sync);
    const markStandalone = () => setStandalone(isStandaloneDisplay());
    window.addEventListener('appinstalled', markStandalone);
    const mq = window.matchMedia?.('(display-mode: standalone)');
    mq?.addEventListener?.('change', markStandalone);
    return () => {
      window.removeEventListener('beforeinstallprompt', sync);
      window.removeEventListener('appinstalled', markStandalone);
      mq?.removeEventListener?.('change', markStandalone);
    };
  }, []);

  const platform: InstallPlatform = standalone
    ? 'unsupported' // installed: the entry hides itself wherever it is running from
    : isIosInstallable()
      ? 'ios'
      : deferredEvent
        ? 'chromium'
        : 'unsupported';

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    const event = window.__pwaDeferredInstall ?? deferredEvent;
    if (!event) return 'unavailable';
    window.__pwaDeferredInstall = undefined;
    setDeferredEvent(null);
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  }, [deferredEvent]);

  return { platform, canPrompt: platform === 'chromium', promptInstall, standalone };
}
