'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { LibraryPickerCopy } from './libraryPickerCopy';
import styles from './GlobalIngredientPickerRow.module.css';

/** What a row needs to draw itself. Both catalog summary DTOs satisfy it. */
export interface LibraryPickerRowData {
  id: string;
  defaultName: string;
  translations: { name: string }[];
  /** "used on N items" — distinct live products linking to this row. */
  usedOnProductCount?: number;
}

interface LibraryPickerRowProps {
  row: LibraryPickerRowData;
  /** Which catalog's words to render. */
  copy: LibraryPickerCopy;
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
  /**
   * Open the "apply this row to many items" panel (plan S8).
   *
   * Absent on an archived row and on an already-added one — the first is off the shelf and the
   * second is a question about THIS product, while this action is about the catalog. Omitting the
   * prop removes the control rather than disabling it: a disabled button here would suggest the
   * row could be applied by some other means.
   */
  onApplyToItems?: () => void;
}

/**
 * One library row, laid out as the approved screen's two columns: the ENTITY on the left (tick box,
 * name, how many translations it carries, a preview of them) and USAGE on the right.
 *
 * One row for both catalogs (plan S2/S3 for ingredients, S4 for variations) — the shape never
 * differed, only the words, which arrive in `copy`.
 *
 * Two numbers, rendered the same way and for the same reason. The translation count is the row's
 * selling point — how many free-text inputs picking it saves — and the usage count is its blast
 * radius. Both are a number plus a translated `aria-label`, NOT an interpolated "N items" string:
 * that sentence needs per-locale plural forms in ten bundles (three categories in ru, six in ar) to
 * avoid reading "1 items". The column header carries the words instead.
 *
 * **There is no price here, and on the variation side its absence is a feature.** That catalog
 * carries none (backend #431) because a variation's money is per product — "Large" is +2.00 on a
 * pizza and +0.50 on a coffee — so what a pick saves is the translations, and the admin still types
 * the one number the library could never have known.
 *
 * The destructive action says what the server will actually do — Archive while anything uses the
 * row, Delete only at zero — because `DELETE /api/global-…/{id}` branches on exactly that count. A
 * button that promised "Delete" and archived instead would be lying about the one thing the admin
 * is trying to decide.
 */
export default function LibraryPickerRow({
  row,
  copy,
  checked = false,
  alreadyAdded = false,
  onToggle,
  archived = false,
  onArchive,
  onRestore,
  isPending = false,
  onApplyToItems,
}: Readonly<LibraryPickerRowProps>) {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const preview = row.translations
    .slice(0, 3)
    .map((translation) => translation.name)
    .join(' · ');

  const usageCount = row.usedOnProductCount ?? 0;
  const isInUse = usageCount > 0;
  const destructiveLabel = isInUse ? t(copy.archiveAction) : t(copy.deleteAction);

  const confirmDestructive = () => {
    setIsConfirming(false);
    onArchive?.();
  };

  return (
    <li className={`${styles.row} ${alreadyAdded || archived ? styles.rowDisabled : ''}`}>
      <div className={styles.identity}>
        <div className={styles.nameLine}>
          {archived ? (
            <span className={styles.archivedName}>{row.defaultName}</span>
          ) : (
            /* An already-added row is drawn TICKED and dimmed, not unticked and disabled (review
               gap G23, frontend #581). Unticked read as "not selected" — the opposite of what is
               true — and the italic `already added` in the USAGE cell had to overturn it. Ticked
               says "this one is on the item", which is also what a screen reader then announces:
               checked, dimmed. It carries no selection: `alreadyAdded` rows are excluded from the
               modal's own state, which is what the Add button counts. */
            <CheckboxField
              label={row.defaultName}
              checked={alreadyAdded || checked}
              disabled={alreadyAdded}
              onChange={onToggle ?? (() => {})}
            />
          )}
          <span className={styles.badge} aria-label={t(copy.languages, { count: row.translations.length })}>
            <Globe size={12} aria-hidden="true" />
            {row.translations.length}
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
          <span className={styles.usageCount} aria-label={t(copy.usedOn, { count: usageCount })}>
            {usageCount}
          </span>
        )}

        {/* The catalog-wide action, beside the row's own destructive one (plan S8). It sits here
            rather than in the footer because it is about THIS row: the footer's Add applies the
            ticked rows to the product being edited, and the two would be indistinguishable. */}
        {!archived && !alreadyAdded && onApplyToItems && (
          <button type="button" className={styles.rowAction} onClick={onApplyToItems} disabled={isPending}>
            {t(copy.applyAction)}
          </button>
        )}

        {archived && onRestore && (
          <button type="button" className={styles.rowAction} onClick={onRestore} disabled={isPending}>
            {t(copy.restore)}
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
            <span className={styles.confirmQuestion}>{isInUse ? t(copy.archiveConfirm) : t(copy.deleteConfirm)}</span>
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
