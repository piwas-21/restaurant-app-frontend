'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/utils/currency';
import styles from './EditorSideRail.module.css';

interface EditorSideRailProps {
  // readonly: S6759 — component props are never mutated.
  /** The item's status flags (S2). A bundle passes none — its own three stay in `BundlePanel`. */
  readonly status?: React.ReactNode;
  readonly basePrice: number;
  /** The primary category's name, or empty when the item has none yet. */
  readonly categoryName?: string;
  /** True while `availableOrderTypes` is null, i.e. the item follows its category (D6). */
  readonly inheritsOrderTypes: boolean;
  readonly photoCount: number;
  /** A bundle has no categories and (frontend #524) no gallery — those rows are omitted for it. */
  readonly showCategory: boolean;
  readonly showPhotos: boolean;
}

const EMPTY = '—';

/**
 * The editor's side rail (plan §4): the item's Status card, then the read-only "At a glance" rows.
 *
 * S1 shipped the summary alone because its contract was that no field moves. S2 brings §4's Status
 * toggles up here — `isActive` / `isAvailable` / `isSpecial` used to open the `Details` column, so
 * "is this item live?" was answered in the middle of a 150-control scroll, while the rail is the
 * one surface visible from every section. The completeness meter is still S10.
 *
 * Every "At a glance" row stays READ-ONLY and derived from the form's own values.
 *
 * The price is rendered through `formatCurrency`, never a hardcoded symbol: the approved screens
 * show `$ 12.00`, but the currency is the tenant's (`NEXT_PUBLIC_TENANT_CURRENCY`, CHF for RUMI).
 */
export default function EditorSideRail({
  status,
  basePrice,
  categoryName,
  inheritsOrderTypes,
  photoCount,
  showCategory,
  showPhotos,
}: EditorSideRailProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.stack}>
      {status}
      <section className={styles.card} aria-labelledby="editor-rail-heading">
        <h2 id="editor-rail-heading" className={styles.heading}>
          {t('editor_at_a_glance')}
        </h2>
        <dl className={styles.list}>
          <div className={styles.row}>
            <dt className={styles.term}>{t('price')}</dt>
            <dd className={styles.value}>{formatCurrency(basePrice)}</dd>
          </div>
          {showCategory && (
            <div className={styles.row}>
              <dt className={styles.term}>{t('category')}</dt>
              <dd className={styles.value}>{categoryName || EMPTY}</dd>
            </div>
          )}
          <div className={styles.row}>
            <dt className={styles.term}>{t('order_types')}</dt>
            <dd className={styles.value}>
              {inheritsOrderTypes ? t('product_order_types_inherit') : t('product_order_types_custom')}
            </dd>
          </div>
          {showPhotos && (
            <div className={styles.row}>
              <dt className={styles.term}>{t('product_images')}</dt>
              <dd className={styles.value}>{photoCount}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
