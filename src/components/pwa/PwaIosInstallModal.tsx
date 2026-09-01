'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Share, Plus, Check } from 'lucide-react';
import BaseModal from '@/components/design-system/BaseModal';
import styles from './PwaIosInstallModal.module.css';

interface PwaIosInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * iOS has no `beforeinstallprompt` and no programmatic install, so the only honest UI is a
 * recipe. Opened from the banner's button — never on its own, so nothing full-screen ever appears
 * unasked.
 */
export default function PwaIosInstallModal({ isOpen, onClose }: Readonly<PwaIosInstallModalProps>) {
  const { t } = useTranslation();

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={t('pwa_install_ios_title')} size="sm">
      <ol className={styles.steps}>
        <li className={styles.step}>
          <Share className={styles.stepIcon} size={20} aria-hidden="true" />
          <span>{t('pwa_install_ios_step_share')}</span>
        </li>
        <li className={styles.step}>
          <Plus className={styles.stepIcon} size={20} aria-hidden="true" />
          <span>{t('pwa_install_ios_step_add')}</span>
        </li>
        <li className={styles.step}>
          <Check className={styles.stepIcon} size={20} aria-hidden="true" />
          <span>{t('pwa_install_ios_step_confirm')}</span>
        </li>
      </ol>
      <button type="button" className={`${styles.button} ${styles.primary} ${styles.blockButton}`} onClick={onClose}>
        {t('pwa_install_ios_done')}
      </button>
    </BaseModal>
  );
}
