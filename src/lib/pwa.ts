/**
 * Platform detection for the "add to home screen" prompt (task A / PWA install).
 *
 * Kept OUT of the hook so each predicate is unit-testable on its own and so the hook stays a
 * state machine rather than a pile of user-agent sniffing. Every function here is browser-only
 * and returns `false` on the server (SSR) — the banner is a client concern and must never
 * influence the server-rendered HTML, or it would hydrate differently per device.
 */

/** Widest viewport we consider "a phone". Desktop admins are never nagged (task A requirement). */
export const MOBILE_MAX_WIDTH_PX = 820;

/** Already installed? Then there is nothing to offer. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  // Chrome/Android + desktop PWAs.
  const displayMode =
    typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari never implemented display-mode for home-screen apps; it sets this legacy flag
  // instead, so BOTH have to be consulted (task A requirement).
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

/** Phone-sized viewport. `matchMedia` rather than innerWidth so an orientation change re-evaluates. */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH_PX}px)`).matches;
}

/**
 * iOS, where `beforeinstallprompt` DOES NOT EXIST — no event ever fires, so the only possible UI
 * is an instruction sheet ("Share → Add to Home Screen").
 *
 * The UA test is deliberate on three axes:
 *  - iPadOS 13+ reports a MacIntel desktop UA, so an iPad is recognised by touch points instead.
 *  - Since iOS 16.4 (2023-03) EVERY real browser on the phone — Safari, Chrome, Firefox, Edge,
 *    Opera — can install a home-screen web app through its OWN share sheet, so the third-party
 *    tokens (CriOS/FxiOS/EdgiOS/OPiOS) are no longer exclusions. Excluding them left iPhone
 *    Chrome users with no install offer at all, which is the report this fixes.
 *  - In-app webviews (Instagram/Facebook and tokenless ones) still get nothing: their share
 *    sheet has no "Add to Home Screen".
 */
export function isIosInstallable(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIpadOs =
    ua.includes('Macintosh') && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  const isIos = /iPhone|iPad|iPod/.test(ua) || isIpadOs;
  if (!isIos) return false;
  const isRealBrowser = /Safari|CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const isKnownWebview = /FBAN|FBAV|Instagram|Line\//.test(ua);
  return isRealBrowser && !isKnownWebview;
}
