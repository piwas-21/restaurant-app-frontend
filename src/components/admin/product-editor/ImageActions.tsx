'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@/app/styles/AdminPage.module.css';
import detailsStyles from '@/app/styles/DetailsPage.module.css';

interface ImageActionsProps {
  // readonly: S6759 — component props are never mutated.
  readonly isPrimary: boolean;
  readonly sortOrder: number;
  readonly disabled: boolean;
  readonly onSetPrimary: () => void;
  readonly onSortOrderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onSortOrderCommit: () => void;
  readonly onDelete: () => void;
}

/**
 * The per-image controls on the unified editor's gallery (menu-bundles #176, slice 7 PR2e).
 *
 * There is no "Save changes" button any more: set-primary and delete apply on click, and the
 * sort order applies on blur (`onSortOrderCommit`). The page owns the one product-level Save;
 * image sub-resource edits go straight to their own endpoints, so a second Save here would be
 * the competing commit point the slice is removing (owner call — "immediate, no rival Save").
 */
export default function ImageActions({
  isPrimary,
  sortOrder,
  disabled,
  onSetPrimary,
  onSortOrderChange,
  onSortOrderCommit,
  onDelete,
}: ImageActionsProps) {
  const { t } = useTranslation();

  return (
    <div className={detailsStyles.imageActions}>
      <div className={detailsStyles.imageActionGroup}>
        <button
          type="button"
          onClick={onSetPrimary}
          disabled={isPrimary || disabled}
          className={`${styles.adminButton} ${isPrimary ? styles.disabled : ''}`}
        >
          {isPrimary ? t('primary') : t('set_as_primary')}
        </button>
        <div className={`${styles.formGroup} ${detailsStyles.imageActionGroup}`}>
          <label htmlFor="sortOrderInput">{t('sort_order')}</label>
          <input
            id="sortOrderInput"
            type="number"
            value={sortOrder}
            disabled={disabled}
            onChange={onSortOrderChange}
            onBlur={onSortOrderCommit}
            className={detailsStyles.sortOrderInput}
          />
        </div>
      </div>
      <div className={detailsStyles.imageActionGroup}>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className={`${styles.adminButton} ${styles.delete}`}
        >
          {t('delete')}
        </button>
      </div>
    </div>
  );
}
