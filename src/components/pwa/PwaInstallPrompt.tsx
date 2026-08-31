'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download } from 'lucide-react';
import { usePwaInstallPrompt } from '@/hooks/usePwaInstallPrompt';
import PwaIosInstallModal from './PwaIosInstallModal';
import styles from './PwaInstallPrompt.module.css';

/**
 * "Add to home screen" — a small bottom banner, mobile only, dismissible, and remembered for 30
 * days (see usePwaInstallPrompt for the eligibility rules).
 *
 * iOS gets as close to Android's one-tap as Apple allows: Apple exposes NO install API on iOS
 * (no `beforeinstallprompt`, no `prompt()`), but the Web Share API opens the NATIVE share sheet
 * from our own button — so the flow is tap "Add to Home Screen" here, then tap the same-named
 * row in Apple's sheet. Two taps, no toolbar hunting. The step-by-step modal remains only for
 * browsers without the Web Share API.
 *
 * It sits ABOVE the cookie banner's published height (`--cookie-banner-h`), which is why it can be
 * rendered unconditionally: when the cookie banner is up, this one moves; when it is gone, the
 * variable is removed and the fallback `0px` applies.
 */
export default function PwaInstallPrompt() {
  const { t } = useTranslation();
  const { variant, install, dismiss } = usePwaInstallPrompt();
  const [isIosSheetOpen, setIosSheetOpen] = useState(false);

  const openNativeShareSheet = async () => {
    try {
      // MUST run inside the tap's user gesture — this is the whole trick: iOS opens its
      // native share sheet over our page, and the guest only taps "Add to Home Screen".
      await navigator.share({ title: document.title, url: window.location.href });
      // Resolving means the guest finished with the sheet — the closest iOS gets to a
      // decision. Honour it for the same 30 days as every other "no"/"done" (we cannot
      // distinguish "added" from "copied the link", so permanent would overclaim).
      dismiss();
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      if (aborted) {
        dismiss();
      } else {
        // No Web Share API, or the platform refused: fall back to the manual steps.
        setIosSheetOpen(true);
      }
    }
  };

  if (variant === 'none') return null;

  return (
    <>
      <section className={styles.banner} aria-label={t('pwa_install_title')}>
        <div className={styles.content}>
          <div className={styles.text}>
            <p className={styles.title}>{t('pwa_install_title')}</p>
            <p className={styles.body}>{t('pwa_install_body')}</p>
          </div>
          <div className={styles.actions}>
            {variant === 'android' ? (
              <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => void install()}>
                <Download size={16} aria-hidden="true" />
                {t('pwa_install_action')}
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                onClick={() => void openNativeShareSheet()}
              >
                {t('pwa_install_ios_action')}
              </button>
            )}
            <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={dismiss}>
              {t('pwa_install_dismiss')}
            </button>
          </div>
        </div>
        <button type="button" className={styles.close} onClick={dismiss} aria-label={t('pwa_install_close_aria')}>
          <X size={18} aria-hidden="true" />
        </button>
      </section>
      <PwaIosInstallModal isOpen={isIosSheetOpen} onClose={() => setIosSheetOpen(false)} />
    </>
  );
}
