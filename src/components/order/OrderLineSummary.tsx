'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import { type LineSummary, type LineIngredientDiff } from './lineSummary';
import styles from './OrderLineSummary.module.css';

function DiffRows({ diff }: Readonly<{ diff: LineIngredientDiff }>) {
  const { t } = useTranslation();
  return (
    <>
      {diff.added.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>{t('added_ingredients', 'Added')}:</span>
          <span className={styles.value}>
            {diff.added.map((ing, i) => (
              <span key={ing.name}>
                {i > 0 && ', '}
                {ing.name}
                {ing.quantity > 1 && ` × ${ing.quantity}`}
              </span>
            ))}
          </span>
        </div>
      )}
      {diff.removed.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>{t('removed_ingredients', 'Removed')}:</span>
          <span className={styles.value}>{diff.removed.join(', ')}</span>
        </div>
      )}
    </>
  );
}

interface OrderLineSummaryProps {
  readonly line: LineSummary;
  /** Hide the line's own special-instructions row (e.g. the cart shows an editable editor instead). */
  readonly hideInstructions?: boolean;
}

/**
 * Read-only, shared renderer for a line's customizations: ingredient diffs, add-on side items,
 * special requests, and bundle components (indented one level with their own diffs). Renders
 * nothing when there is nothing to show. The two order/cart shapes feed it via the adapters in
 * lineSummary.ts (menu-bundles redesign slice 2, #174).
 */
export default function OrderLineSummary({ line, hideInstructions = false }: OrderLineSummaryProps) {
  const { t } = useTranslation();
  const showInstructions = !hideInstructions && !!line.specialInstructions;

  const nothingToShow =
    line.diff.added.length === 0 &&
    line.diff.removed.length === 0 &&
    line.sideItems.length === 0 &&
    line.children.length === 0 &&
    !showInstructions;
  if (nothingToShow) return null;

  return (
    <div className={styles.summary}>
      <DiffRows diff={line.diff} />

      {line.sideItems.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>{t('side_items', 'Side Items')}:</span>
          <span className={styles.value}>
            {line.sideItems.map((side, i) => (
              <span key={side.id ?? side.name}>
                {i > 0 && ', '}
                {side.name}
                {side.quantity > 1 && ` × ${side.quantity}`}
                {typeof side.price === 'number' && side.price > 0 && ` (${formatPlainCurrency(side.price)})`}
              </span>
            ))}
          </span>
        </div>
      )}

      {showInstructions && (
        <div className={styles.row}>
          <span className={styles.label}>{t('special_requests', 'Special Requests')}:</span>
          <span className={styles.value}>{line.specialInstructions}</span>
        </div>
      )}

      {line.children.length > 0 && (
        <ul className={styles.children}>
          {line.children.map((child) => {
            const hasDetails =
              child.diff.added.length > 0 || child.diff.removed.length > 0 || !!child.specialInstructions;
            return (
              <li key={child.id ?? child.name} className={styles.child}>
                <span className={styles.childName}>
                  {child.name}
                  {child.quantity > 1 && ` × ${child.quantity}`}
                </span>
                {hasDetails && (
                  <div className={styles.childDetails}>
                    <DiffRows diff={child.diff} />
                    {child.specialInstructions && (
                      <div className={styles.row}>
                        <span className={styles.label}>{t('special_requests', 'Special Requests')}:</span>
                        <span className={styles.value}>{child.specialInstructions}</span>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
