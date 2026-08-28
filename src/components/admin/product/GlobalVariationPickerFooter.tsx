'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { VariationLibraryView } from './GlobalVariationPickerToolbar';
// Shares the ingredient picker's stylesheet — see `GlobalVariationPickerToolbar`.
import styles from './GlobalIngredientPickerModal.module.css';

interface GlobalVariationPickerFooterProps {
  view: VariationLibraryView;
  /** The trimmed search term — what "+ Create new" would create. */
  newName: string;
  isCreating: boolean;
  onCreate: () => void;
  onCancel: () => void;
  selectedCount: number;
  onAdd: () => void;
}

/**
 * The picker's footer: create-and-attach on the left, cancel and confirm on the right.
 *
 * Both writing actions are hidden in the archived view. Nothing there can be attached (plan D4) and
 * nothing there is a search result, so both would be offering something the view cannot do; only
 * the way out stays.
 */
export default function GlobalVariationPickerFooter({
  view,
  newName,
  isCreating,
  onCreate,
  onCancel,
  selectedCount,
  onAdd,
}: Readonly<GlobalVariationPickerFooterProps>) {
  const { t } = useTranslation();

  return (
    <div className={styles.footer}>
      {view === 'active' && (
        <button type="button" className={styles.createButton} onClick={onCreate} disabled={isCreating}>
          <Plus size={16} aria-hidden="true" />
          {newName.length > 0 ? t('variation_library_create_named', { name: newName }) : t('variation_library_create')}
        </button>
      )}
      <div className={styles.footerActions}>
        <button type="button" className={styles.cancelButton} onClick={onCancel}>
          {t('cancel')}
        </button>
        {view === 'active' && (
          <button type="button" className={styles.confirmButton} onClick={onAdd} disabled={selectedCount === 0}>
            {t('add_selected')}
            {selectedCount > 0 && <span className={styles.count}> ({selectedCount})</span>}
          </button>
        )}
      </div>
    </div>
  );
}
