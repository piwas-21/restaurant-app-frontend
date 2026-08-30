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
 * It sits ABOVE the cookie banner's published height (`--cookie-banner-h`), which is why it can be
 * rendered unconditionally: when the cookie banner is up, this one moves; when it is gone, the
 * variable is removed and the fallback `0px` applies.
 */
export default function PwaInstallPrompt() {
  const { t } = useTranslation();
  const { variant, install, dismiss } = usePwaInstallPrompt();
  const [isIosSheetOpen, setIosSheetOpen] = useState(false);

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
                onClick={() => setIosSheetOpen(true)}
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
