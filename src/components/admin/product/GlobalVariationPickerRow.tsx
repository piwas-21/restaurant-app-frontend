'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { GlobalVariationSummary } from '@/services/globalVariationService';
// Shares the ingredient row's stylesheet — see `GlobalVariationPickerToolbar`.
import styles from './GlobalIngredientPickerRow.module.css';

interface GlobalVariationPickerRowProps {
  variation: GlobalVariationSummary;
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
 * One variation-library row: VARIATION on the left (tick box, name, how many translations it
 * carries, a preview of them) and USAGE on the right.
 *
 * **There is no price on this row, and its absence is the feature.** The catalog carries none
 * (backend #431) because a variation's money is per product — "Large" is +2.00 on a pizza and
 * +0.50 on a coffee — so what a pick saves is the nine translations, and what the admin still
 * types is the one number the library could never have known. A price column here would have to
 * invent a figure or show a blank, and both would misdescribe what picking the row does.
 *
 * Both numbers render as a bare figure plus a translated `aria-label`, NOT an interpolated
 * "N items" string: that sentence needs per-locale plural forms in ten bundles (three categories in
 * ru, six in ar) to avoid reading "1 items". The column header carries the words instead.
 *
 * The destructive action says what the server will actually do — Archive while anything uses the
 * row, Delete only at zero — because `DELETE /api/global-variations/{id}` branches on exactly that
 * count. A button that promised "Delete" and archived instead would be lying about the one thing
 * the admin is trying to decide.
 */
export default function GlobalVariationPickerRow({
  variation,
  checked = false,
  alreadyAdded = false,
  onToggle,
  archived = false,
  onArchive,
  onRestore,
  isPending = false,
}: Readonly<GlobalVariationPickerRowProps>) {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const preview = variation.translations
    .slice(0, 3)
    .map((translation) => translation.name)
    .join(' · ');

  const usageCount = variation.usedOnProductCount ?? 0;
  const isInUse = usageCount > 0;
  const destructiveLabel = isInUse ? t('variation_library_archive') : t('variation_library_delete');

  const confirmDestructive = () => {
    setIsConfirming(false);
    onArchive?.();
  };

  return (
    <li className={`${styles.row} ${alreadyAdded || archived ? styles.rowDisabled : ''}`}>
      <div className={styles.identity}>
        <div className={styles.nameLine}>
          {archived ? (
            <span className={styles.archivedName}>{variation.defaultName}</span>
          ) : (
            /* An already-added row is drawn TICKED and dimmed, not unticked and disabled (review
               gap G23, shipped for ingredients in frontend #597). Unticked read as "not selected" —
               the opposite of what is true — and the italic `already added` in the USAGE cell had
               to overturn it. Ticked says "this one is on the item", which is also what a screen
               reader then announces: checked, dimmed. It carries no selection: `alreadyAdded` rows
               are excluded from the modal's own state, which is what the Add button counts. */
            <CheckboxField
              label={variation.defaultName}
              checked={alreadyAdded || checked}
              disabled={alreadyAdded}
              onChange={onToggle ?? (() => {})}
            />
          )}
          <span
            className={styles.badge}
            aria-label={t('variation_library_languages', { count: variation.translations.length })}
          >
            <Globe size={12} aria-hidden="true" />
            {variation.translations.length}
          </span>
        </div>
        {preview.length > 0 && <p className={styles.preview}>{preview}</p>}
      </div>

      <div className={styles.usage}>
        {alreadyAdded ? (
          // "already added" goes in the USAGE cell in place of the figure — the row is already
          // accounted for, so its blast radius is not the question being asked.
          <span className={styles.alreadyAdded}>{t('already_added')}</span>
        ) : (
          <span className={styles.usageCount} aria-label={t('variation_library_used_on', { count: usageCount })}>
            {usageCount}
          </span>
        )}

        {archived && onRestore && (
          <button type="button" className={styles.rowAction} onClick={onRestore} disabled={isPending}>
            {t('variation_library_restore')}
          </button>
        )}

        {/* A lightweight inline confirm, inside the row. The picker is itself a BaseModal, and a
            second modal over it would be a dialog over a dialog for a reversible action. */}
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
              {isInUse ? t('variation_library_archive_confirm') : t('variation_library_delete_confirm')}
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
