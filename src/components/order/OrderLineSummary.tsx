'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import { type LineSummary, type LineIngredientDiff, type LineChild } from './lineSummary';
import styles from './OrderLineSummary.module.css';

/**
 * Every value rendered here is TENANT-authored — ingredient, component and side-item names, and
 * free-text special instructions — so each carries `dir="auto"`: an English name inside an Arabic
 * page is an LTR run whose trailing neutral punctuation would otherwise take the paragraph's
 * direction and jump to the far end (DESIGN-SYSTEM.md §8.2). The `.label` spans beside them are
 * locale strings and correctly inherit.
 */

function DiffRows({ diff }: Readonly<{ diff: LineIngredientDiff }>) {
  const { t } = useTranslation();
  return (
    <>
      {diff.added.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>{t('added_ingredients', 'Added')}:</span>
          <span className={styles.value}>
            {diff.added.map((ing, i) => (
              <React.Fragment key={ing.name}>
                {i > 0 && ', '}
                {/* Only the NAME is isolated. `dir="auto"` implies `unicode-bidi: isolate`, so a
                    separator inside the span paints at that box's own leading edge and the gap
                    between two items collapses to 0px — measured, `ColeslawFries`. The numeric
                    suffix is direction-neutral and stays outside too. */}
                <span dir="auto">{ing.name}</span>
                {ing.quantity > 1 && ` × ${ing.quantity}`}
              </React.Fragment>
            ))}
          </span>
        </div>
      )}
      {diff.removed.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>{t('removed_ingredients', 'Removed')}:</span>
          <span dir="auto" className={styles.value}>
            {diff.removed.join(', ')}
          </span>
        </div>
      )}
    </>
  );
}

/**
 * Bundle components, indented one level per depth. Recursive because the order/cart trees nest to
 * arbitrary depth (a component of a component would otherwise never be drawn).
 */
function ChildList({ items }: Readonly<{ items: LineChild[] }>) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <ul className={styles.children}>
      {items.map((child) => {
        const hasDetails = child.diff.added.length > 0 || child.diff.removed.length > 0 || !!child.specialInstructions;
        return (
          <li key={child.id ?? child.name} className={styles.child}>
            <span dir="auto" className={styles.childName}>
              {child.name}
              {child.quantity > 1 && ` × ${child.quantity}`}
            </span>
            {hasDetails && (
              <div className={styles.childDetails}>
                <DiffRows diff={child.diff} />
                {child.specialInstructions && (
                  <div className={styles.row}>
                    <span className={styles.label}>{t('special_requests', 'Special Requests')}:</span>
                    <span dir="auto" className={styles.value}>
                      {child.specialInstructions}
                    </span>
                  </div>
                )}
              </div>
            )}
            <ChildList items={child.children} />
          </li>
        );
      })}
    </ul>
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
              <React.Fragment key={side.id ?? side.name}>
                {i > 0 && ', '}
                {/* Separator and numeric suffixes outside the isolate — see the added row above. */}
                <span dir="auto">{side.name}</span>
                {side.quantity > 1 && ` × ${side.quantity}`}
                {typeof side.price === 'number' && side.price > 0 && ` (${formatPlainCurrency(side.price)})`}
              </React.Fragment>
            ))}
          </span>
        </div>
      )}

      {showInstructions && (
        <div className={styles.row}>
          <span className={styles.label}>{t('special_requests', 'Special Requests')}:</span>
          <span dir="auto" className={styles.value}>
            {line.specialInstructions}
          </span>
        </div>
      )}

      <ChildList items={line.children} />
    </div>
  );
}
