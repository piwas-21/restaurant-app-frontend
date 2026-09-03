/**
 * Platform detection for the "add to home screen" prompt (task A / PWA install).
 *
 * Kept OUT of the hook so each predicate is unit-testable on its own and so the hook stays a
 * state machine rather than a pile of user-agent sniffing. Every function here is browser-only
 * and returns `false` on the server (SSR) — the banner is a client concern and must never
 * influence the server-rendered HTML, or it would hydrate differently per device.
 */

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

/**
 * A HANDHELD — a phone or a tablet — which is the only place the install offer belongs.
 *
 * Chromium fires `beforeinstallprompt` on the desktop too, so the nav entry appeared on a laptop
 * and offered to install a restaurant's ordering app as a desktop window. That is the report this
 * closes. iOS needs no test of its own: `isIosInstallable` already only ever answers true on a
 * phone or an iPad.
 *
 * TWO conditions, both required, because either alone is wrong:
 *  - `(pointer: coarse)` alone admits a touchscreen laptop, which is a desktop.
 *  - a width bound alone admits a narrow desktop window, which is still a desktop — and a resized
 *    window is exactly how a developer would notice, since the offer would appear and disappear.
 * A 1024px ceiling puts every phone and every tablet in portrait or landscape inside it (an iPad
 * Pro's 1024pt landscape is the widest thing that has to fit) and leaves laptops out.
 *
 * `false` on the server: the entry is a client concern and must never influence the SSR HTML, or it
 * would hydrate differently per device.
 */
export function isHandheldDisplay(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(max-width: 1024px)').matches;
}
