'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import CheckboxField from '@/components/design-system/CheckboxField';
import {
  groupSelectionState,
  toggleGroup,
  type ApplyTargetGroup,
  type ApplyTargetProduct,
} from './libraryApplyTargets';
import type { LibraryPickerCopy } from './libraryPickerCopy';
import type { AttachResult } from '@/services/libraryAttachService';
import styles from './LibraryApplyToItemsPanel.module.css';

interface LibraryApplyToItemsPanelProps {
  /** The library row being applied — its name is the subject of every sentence here. */
  rowName: string;
  copy: LibraryPickerCopy;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  errorKey: string;
  groups: ApplyTargetGroup[];
  products: ApplyTargetProduct[];
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (selected: ReadonlySet<string>) => void;
  alreadyAttachedIds: ReadonlySet<string>;
  /** What the write did, once it has run. Present means the panel is showing its receipt. */
  result: AttachResult | null;
}

/**
 * "Apply this library row to many items" — plan S8, and the screen decision D6 was written for.
 *
 * **It is a panel inside the picker, not a second modal.** The picker is already a `BaseModal`, and
 * a dialog over a dialog for a multi-step action traps focus twice and gives the admin two Escape
 * keys with different meanings. Swapping the body keeps one dialog, one title and one footer.
 *
 * **Every category header is a real tri-state.** A category whose products are partly picked shows
 * indeterminate, because collapsing that to unticked would tell an admin who hand-picked four of
 * forty pizzas that they had picked none. A category whose every product ALREADY carries the row
 * shows ticked and disabled — it is done, not empty.
 *
 * **A product already carrying the row is drawn ticked and disabled**, the same way the library
 * picker draws an already-added catalog row (frontend #581): unticked would read as "not selected",
 * which is the opposite of what is true, and a screen reader then announces checked, dimmed.
 *
 * The blast radius itself lives in the footer, because it is what the confirm button is about; this
 * panel owns the selection and the receipt.
 */
export default function LibraryApplyToItemsPanel({
  rowName,
  copy,
  status,
  error,
  errorKey,
  groups,
  products,
  selectedIds,
  onSelectionChange,
  alreadyAttachedIds,
  result,
}: Readonly<LibraryApplyToItemsPanelProps>) {
  const { t } = useTranslation();
  const nameOf = (id: string) => products.find((product) => product.id === id)?.name ?? id;

  if (result) {
    return (
      <div className={styles.receipt}>
        <p className={styles.receiptHeadline}>{t(copy.applyDone, { count: result.attachedProductIds.length })}</p>
        {result.skipped.length > 0 && (
          <p className={styles.receiptSkipped}>{t(copy.applySkipped, { count: result.skipped.length })}</p>
        )}
      </div>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return <p className={styles.notice}>{t(copy.applyLoading)}</p>;
  }

  if (status === 'error') {
    return (
      <p className={styles.error} role="alert">
        {error ?? t(errorKey)}
      </p>
    );
  }

  return (
    <div className={styles.panel}>
      <p className={styles.lead}>{t(copy.applyLead, { name: rowName })}</p>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {groups.length === 0 && <p className={styles.notice}>{t(copy.applyEmpty)}</p>}

      {groups.map((group) => {
        const state = groupSelectionState(group, selectedIds, alreadyAttachedIds);
        const isDone = group.productIds.every((id) => alreadyAttachedIds.has(id));

        return (
          <section key={group.categoryId} className={styles.group}>
            <header className={styles.groupHeader}>
              <CheckboxField
                label={group.categoryName}
                checked={state === 'all'}
                indeterminate={state === 'some'}
                disabled={isDone}
                onChange={(checked) => onSelectionChange(toggleGroup(group, checked, selectedIds))}
              />
              <span className={styles.groupCount} aria-hidden="true">
                {group.productIds.length}
              </span>
            </header>

            <ul className={styles.productList}>
              {group.productIds.map((productId) => {
                const already = alreadyAttachedIds.has(productId);
                return (
                  <li key={`${group.categoryId}:${productId}`} className={styles.product}>
                    <CheckboxField
                      label={nameOf(productId)}
                      checked={already || selectedIds.has(productId)}
                      disabled={already}
                      onChange={(checked) => {
                        const next = new Set(selectedIds);
                        if (checked) next.add(productId);
                        else next.delete(productId);
                        onSelectionChange(next);
                      }}
                    />
                    {already && <span className={styles.alreadyHas}>{t('already_added')}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
