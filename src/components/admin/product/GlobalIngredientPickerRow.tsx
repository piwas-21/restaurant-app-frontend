'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { GlobalIngredientSummary } from '@/services/globalIngredientService';
import styles from './GlobalIngredientPickerRow.module.css';

interface GlobalIngredientPickerRowProps {
  ingredient: GlobalIngredientSummary;
  checked?: boolean;
  /** Already on the product: shown, but not offerable a second time. */
  alreadyAdded?: boolean;
  onToggle?: (checked: boolean) => void;
  /**
   * An archived row (plan D4). It is never selectable — there is no tick box at all, because a
   * disabled one would suggest the row could become attachable by some other means — and it
   * carries a Restore action instead of the destructive one.
   */
  archived?: boolean;
  /** Archive or delete this row. The label of the control is derived from the usage count. */
  onArchive?: () => void;
  /** Un-archive this row. */
  onRestore?: () => void;
  /** A write for this row is in flight; both actions are held. */
  isPending?: boolean;
}

/**
 * One library row, laid out as the approved screen's two columns: INGREDIENT on the left (tick box,
 * name, how many translations it carries, a preview of them) and USAGE on the right.
 *
 * Two numbers, rendered the same way and for the same reason. The translation count is the row's
 * selling point — how many free-text inputs picking it saves — and the usage count is its blast
 * radius. Both are a number plus a translated `aria-label`, NOT an interpolated "N items" string:
 * that sentence needs per-locale plural forms in ten bundles (three categories in ru, six in ar) to
 * avoid reading "1 items". The approved screen writes the sentence out; this is the same deviation
 * S2 already shipped for the languages badge, and the column header carries the words instead.
 *
 * The destructive action says what the server will actually do — Archive while anything uses the
 * row, Delete only at zero — because `DELETE /api/global-ingredients/{id}` branches on exactly that
 * count. A button that promised "Delete" and archived instead would be lying about the one thing
 * the admin is trying to decide.
 */
export default function GlobalIngredientPickerRow({
  ingredient,
  checked = false,
  alreadyAdded = false,
  onToggle,
  archived = false,
  onArchive,
  onRestore,
  isPending = false,
}: Readonly<GlobalIngredientPickerRowProps>) {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const preview = ingredient.translations
    .slice(0, 3)
    .map((translation) => translation.name)
    .join(' · ');

  const usageCount = ingredient.usedOnProductCount ?? 0;
  const isInUse = usageCount > 0;
  const destructiveLabel = isInUse ? t('ingredient_library_archive') : t('ingredient_library_delete');

  const confirmDestructive = () => {
    setIsConfirming(false);
    onArchive?.();
  };

  return (
    <li className={`${styles.row} ${alreadyAdded || archived ? styles.rowDisabled : ''}`}>
      <div className={styles.identity}>
        <div className={styles.nameLine}>
          {archived ? (
            <span className={styles.archivedName}>{ingredient.defaultName}</span>
          ) : (
            <CheckboxField
              label={ingredient.defaultName}
              checked={checked}
              disabled={alreadyAdded}
              onChange={onToggle ?? (() => {})}
            />
          )}
          <span
            className={styles.badge}
            aria-label={t('ingredient_library_languages', { count: ingredient.translations.length })}
          >
            <Globe size={12} aria-hidden="true" />
            {ingredient.translations.length}
          </span>
        </div>
        {preview.length > 0 && <p className={styles.preview}>{preview}</p>}
      </div>

      <div className={styles.usage}>
        {alreadyAdded ? (
          // The approved screen puts "already added" in the USAGE cell, in italics, in place of the
          // figure — the row is already accounted for, so its blast radius is not the question.
          <span className={styles.alreadyAdded}>{t('already_added')}</span>
        ) : (
          <span className={styles.usageCount} aria-label={t('ingredient_library_used_on', { count: usageCount })}>
            {usageCount}
          </span>
        )}

        {archived && onRestore && (
          <button type="button" className={styles.rowAction} onClick={onRestore} disabled={isPending}>
            {t('ingredient_library_restore')}
          </button>
        )}

        {/* A lightweight inline confirm, inside the row. The picker is itself a BaseModal, and a
            second modal over it would be a dialog over a dialog for a reversible action. The
            "what will this change" dialog is a later slice (plan S8). */}
        {!archived && onArchive && !isConfirming && (
          <button
            type="button"
            className={`${styles.rowAction} ${styles.rowActionDanger}`}
            onClick={() => setIsConfirming(true)}
            disabled={isPending}
          >
            {destructiveLabel}
          </button>
        )}
        {!archived && onArchive && isConfirming && (
          <span className={styles.confirm}>
            <span className={styles.confirmQuestion}>
              {isInUse ? t('ingredient_library_archive_confirm') : t('ingredient_library_delete_confirm')}
            </span>
            <button
              type="button"
              className={`${styles.rowAction} ${styles.rowActionDanger}`}
              onClick={confirmDestructive}
              disabled={isPending}
            >
              {t('confirm')}
            </button>
            <button type="button" className={styles.rowAction} onClick={() => setIsConfirming(false)}>
              {t('cancel')}
            </button>
          </span>
        )}
      </div>
    </li>
  );
}
