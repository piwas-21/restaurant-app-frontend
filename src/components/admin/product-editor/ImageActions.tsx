'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@/app/styles/AdminPage.module.css';
import galleryStyles from './ImageGallery.module.css';
import { INTEGER_INPUT_PROPS } from '@/components/admin/product/numberInputProps';

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
    /*
     * A LABELLED panel. The band this replaces said nothing about WHICH photo it acted on, and sat
     * two rows above "Upload more images" — so "Delete" read as an action on the section rather
     * than on the selected thumbnail, and the two groups had visibly collided (the borrowed
     * stylesheet's leftover `position: sticky`).
     */
    <section className={galleryStyles.selected} aria-label={t('editor_media_selected_image')}>
      <p className={galleryStyles.selectedLabel}>{t('editor_media_selected_image')}</p>
      <div className={galleryStyles.selectedActions}>
        <button
          type="button"
          onClick={onSetPrimary}
          disabled={isPrimary || disabled}
          className={`${styles.adminButton} ${isPrimary ? styles.disabled : ''}`}
        >
          {isPrimary ? t('primary') : t('set_as_primary')}
        </button>
        <label className={galleryStyles.sortField} htmlFor="sortOrderInput">
          {t('sort_order')}
          {/* The shared count convention (S8): a sort order is a whole number that cannot be
              negative, and a bare `type="number"` offered a phone the wrong keyboard. */}
          <input
            id="sortOrderInput"
            {...INTEGER_INPUT_PROPS}
            value={sortOrder}
            disabled={disabled}
            onChange={onSortOrderChange}
            onBlur={onSortOrderCommit}
            className={galleryStyles.sortInput}
          />
        </label>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className={`${styles.adminButton} ${styles.delete} ${galleryStyles.deleteAction}`}
        >
          {t('delete')}
        </button>
      </div>
    </section>
  );
}
