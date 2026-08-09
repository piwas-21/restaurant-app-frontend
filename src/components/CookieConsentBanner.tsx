'use client';

import React, { useCallback, useRef } from 'react';
import { useCookieConsent } from './CookieConsentContext';
import styles from '../app/styles/CookieConsentBanner.module.css';
import { useTranslation } from 'react-i18next';

/**
 * The custom property this banner publishes while it is on screen, so anything else pinned to the
 * bottom of the viewport can get out of its way.
 *
 * It exists because the banner was silently sitting ON the floating cart button — `/menu`'s only
 * route to the basket since the sticky-bar copy was removed. The banner is `z-index: 2000` against
 * the button's 100, so a first-time guest's tap landed on the banner: measured at 1280×720, the
 * banner occupies y 644–720 and the button y 632–696, and `elementFromPoint` at the button's centre
 * returns the banner. Thirteen e2e tests found this before any human did.
 *
 * A published HEIGHT rather than a "banner is up" boolean, because the height is what a consumer
 * actually needs and it is not a constant — the copy wraps to a different number of lines at every
 * width and in every locale.
 */
export const COOKIE_BANNER_HEIGHT_VAR = '--cookie-banner-h';

export default function CookieConsentBanner() {
  const { consent, isConsentPending, acceptPreferences, declinePreferences } = useCookieConsent();
  const { t } = useTranslation();
  const observerRef = useRef<ResizeObserver | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  /**
   * Publish the banner's height while it is up; take it away the moment it is not.
   *
   * A CALLBACK ref rather than `useEffect` + `useRef`, because the effect version measured **715px**
   * for a 76px banner — and the FAB, dutifully adding that to its `bottom`, flew to y −83, off the
   * top of the viewport. The callback ref measures at attach and gets 76.1875px, matching the box
   * exactly. React also invokes it with `null` and then the new node on every swap, so it cannot be
   * left bound to a node React has replaced.
   *
   * **Honest limit: I never established why the effect's first read was 715px.** The obvious
   * suspects (a detached node, a stylesheet that had not landed) are guesses, and the environment
   * that would test them cannot: the review pane runs with `visibilityState: 'hidden'`, where the
   * rendering steps do not run at all — measured, `requestAnimationFrame` and `ResizeObserver`
   * BOTH fail to deliver. So "the observer never corrected it" is explained by the pane, not by
   * anything about the node, and no stronger claim is available from here.
   *
   * That limit is exactly why the size is tracked TWICE below. A `ResizeObserver` is the right tool
   * and is correct in a real browser, but its callback is the one thing that could not be verified;
   * `resize` is coarser and fires as an ordinary event. Together the common case (a rotation, a
   * window drag, a longer locale rewrapping the copy) is covered by a path that can be checked.
   *
   * `{ box: 'border-box' }`: `ResizeObserver` defaults to the CONTENT box, and this banner's padding
   * is a third of its height — the default would clear the text and not the box.
   */
  const measureBanner = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const root = document.documentElement;
    if (!el) {
      root.style.removeProperty(COOKIE_BANNER_HEIGHT_VAR);
      return;
    }

    const publish = () => root.style.setProperty(COOKIE_BANNER_HEIGHT_VAR, `${el.getBoundingClientRect().height}px`);
    publish();

    window.addEventListener('resize', publish);
    cleanupRef.current = () => window.removeEventListener('resize', publish);

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(publish);
    observer.observe(el, { box: 'border-box' });
    observerRef.current = observer;
  }, []);

  // Don't show the banner if consent is no longer pending (i.e., already set or loaded)
  // Or if consent for preferences has already been explicitly given or denied
  if (!isConsentPending && consent.preferences !== null) {
    return null;
  }

  // Also don't show if still loading initial consent state, unless it's determined that preferences is null
  if (isConsentPending && consent.preferences !== null) {
    return null;
  }

  // Only show when consent is loaded (isConsentPending is false) AND preferences is still null
  if (isConsentPending || consent.preferences !== null) {
    return null;
  }

  return (
    <div ref={measureBanner} className={styles.bannerContainer}>
      <div className={styles.bannerContent}>
        <p className={styles.bannerText}>
          {t(
            'cookie_consent_banner_text',
            'We use cookies to enhance your experience. By continuing to visit this site you agree to our use of cookies. For now, this only includes remembering your language preference.',
          )}
        </p>
        <div className={styles.bannerActions}>
          <button onClick={acceptPreferences} className={`${styles.bannerButton} ${styles.acceptButton}`}>
            {t('cookie_consent_accept', 'Accept')}
          </button>
          <button onClick={declinePreferences} className={`${styles.bannerButton} ${styles.declineButton}`}>
            {t('cookie_consent_decline', 'Decline')}
          </button>
          {/* <button onClick={openSettings} className={styles.settingsButton}>Settings</button> // For future expansion */}
        </div>
      </div>
    </div>
  );
}
