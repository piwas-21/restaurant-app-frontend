'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import styles from '@/app/styles/AdminPage.module.css';

interface NewProductTypeModalProps {
  // readonly: S6759 — component props are never mutated.
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** `true` → menu bundle, `false` → plain menu item. */
  readonly onSelect: (isBundle: boolean) => void;
}

/**
 * The "New product" type chooser (menu-bundles redesign #176, slice 7 PR2e). Type is picked
 * once here — a menu item and a menu bundle load different fields and the backend can't migrate
 * between them, so the choice is made before the create page opens, not inside it.
 */
export default function NewProductTypeModal({ isOpen, onClose, onSelect }: NewProductTypeModalProps) {
  const { t } = useTranslation();

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={t('product_type')} size="sm">
      <div className={styles.pageActions}>
        <button type="button" className={`${styles.adminButton} ${styles.add}`} onClick={() => onSelect(false)}>
          {t('create_new_product')}
        </button>
        <button type="button" className={`${styles.adminButton} ${styles.add}`} onClick={() => onSelect(true)}>
          {t('create_new_menu_bundle')}
        </button>
      </div>
    </BaseModal>
  );
}
