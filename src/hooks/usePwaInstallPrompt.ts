'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isIosInstallable, isMobileViewport, isStandaloneDisplay } from '@/lib/pwa';

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
// A missed event is a lost offer: preventDefault() here also stops Chrome's own infobar from
// winning the race to be the only prompt on screen. The hook consumes the parked event first
// (and drops it when the visitor decides), then subscribes for late firings as before.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.__pwaDeferredInstall = event as BeforeInstallPromptEvent;
  });
}

/** localStorage key holding the epoch ms of the last dismissal (or `installed`). */
export const PWA_DISMISSED_KEY = 'pwa_install_dismissed_at';
/** localStorage key holding how many times this browser has opened the app. */
export const PWA_VISITS_KEY = 'pwa_visit_count';
/** Sentinel written when the app is installed (or the user accepts) — we then never ask again. */
export const PWA_INSTALLED = 'installed';

/**
 * How long a dismissal is honoured. 30 days: long enough that "no" means no for a whole ordering
 * cycle, short enough that a guest who declined once in a hurry can still install later. An
 * ACCEPTED install (or an `appinstalled` event) is permanent, not 30 days.
 */
export const REASK_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
/** Offer install on the first eligible mobile visit; this is a user-requested discovery affordance. */
export const MIN_VISITS = 1;
/** Let the page paint first without making the invitation easy to miss. */
export const SHOW_DELAY_MS = 1000;

export type InstallPromptVariant = 'none' | 'android' | 'ios';

/**
 * Safe read: Safari private mode throws on any localStorage access. Treated as "no record".
 *
 * Deliberately NOT surfaced to the user (the bare-catch gate's exemption): a guest who cannot store
 * a preference must not be shown an error about it. The only consequence is that the banner may
 * ask again next session, which is the harmless direction.
 */
function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('[pwa] localStorage unavailable', error);
    return null;
  }
}

/** Safe write — same reasoning as readStorage above. */
function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn('[pwa] localStorage unavailable', error);
  }
}

/** True when a stored dismissal still suppresses the banner. */
export function isSuppressed(now: number): boolean {
  const stored = readStorage(PWA_DISMISSED_KEY);
  if (!stored) return false;
  if (stored === PWA_INSTALLED) return true;
  const at = Number(stored);
  if (!Number.isFinite(at)) return false;
  return now - at < REASK_AFTER_MS;
}

/**
 * Decides whether to offer "add to home screen", and how.
 *
 * Android/Chrome: the browser fires `beforeinstallprompt`; we `preventDefault()` it (which is what
 * suppresses Chrome's own mini-infobar) and keep the event so our own button can call `prompt()`.
 * The event is single-use — after `prompt()` it must be dropped.
 *
 * iOS Safari: no event exists, so eligibility is inferred and the UI can only be instructions.
 */
export function usePwaInstallPrompt() {
  const [variant, setVariant] = useState<InstallPromptVariant>('none');
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  const hide = useCallback(() => {
    setVariant('none');
    deferredRef.current = null;
    // A decided visitor must not find a stale native event parked for the next mount.
    delete window.__pwaDeferredInstall;
  }, []);

  const dismiss = useCallback(() => {
    writeStorage(PWA_DISMISSED_KEY, String(Date.now()));
    hide();
  }, [hide]);

  const install = useCallback(async () => {
    const event = deferredRef.current;
    if (!event) return;
    deferredRef.current = null;
    setVariant('none');
    await event.prompt();
    const choice = await event.userChoice;
    // A declined native dialog is still a "no" — honour it for the same 30 days rather than
    // re-offering on the next page view.
    writeStorage(PWA_DISMISSED_KEY, choice.outcome === 'accepted' ? PWA_INSTALLED : String(Date.now()));
  }, []);

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    if (!isMobileViewport()) return;
    if (isSuppressed(Date.now())) return;

    const visits = Number(readStorage(PWA_VISITS_KEY) ?? '0') + 1;
    writeStorage(PWA_VISITS_KEY, String(visits));

    const onInstalled = () => {
      writeStorage(PWA_DISMISSED_KEY, PWA_INSTALLED);
      hide();
    };
    window.addEventListener('appinstalled', onInstalled);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const showLater = (next: InstallPromptVariant) => {
      clearTimeout(timer);
      timer = setTimeout(() => setVariant(next), SHOW_DELAY_MS);
    };

    const onBeforeInstallPrompt = (event: Event) => {
      // Suppresses Chrome's own infobar so ours is the only prompt on screen. (The module
      // listener above usually got here first; preventDefault twice is harmless.)
      event.preventDefault();
      deferredRef.current = event as BeforeInstallPromptEvent;
      if (visits >= MIN_VISITS) showLater('android');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    // An event parked before mount wins over the iOS instruction sheet: if Chrome already
    // offered a real install, that is the better UI for THIS visitor regardless of platform.
    if (window.__pwaDeferredInstall) {
      deferredRef.current = window.__pwaDeferredInstall;
      delete window.__pwaDeferredInstall;
    }
    if (visits >= MIN_VISITS) {
      if (deferredRef.current) showLater('android');
      else if (isIosInstallable()) showLater('ios');
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [hide]);

  return { variant, install, dismiss };
}
