'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/utils/currency';
import styles from './EditorSideRail.module.css';

interface EditorSideRailProps {
  // readonly: S6759 — component props are never mutated.
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
 * The editor's side rail (plan §4). S1 ships the "At a glance" summary only.
 *
 * Every row is READ-ONLY and derived from the form's own values, so this slice moves no field and
 * renames none — the Status toggles §4 draws here still live in the Details section until S2, and
 * the completeness meter is S10.
 *
 * The price is rendered through `formatCurrency`, never a hardcoded symbol: the approved screens
 * show `$ 12.00`, but the currency is the tenant's (`NEXT_PUBLIC_TENANT_CURRENCY`, CHF for RUMI).
 */
export default function EditorSideRail({
  basePrice,
  categoryName,
  inheritsOrderTypes,
  photoCount,
  showCategory,
  showPhotos,
}: EditorSideRailProps) {
  const { t } = useTranslation();

  return (
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
  );
}
