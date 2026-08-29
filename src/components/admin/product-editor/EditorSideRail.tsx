'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/utils/currency';
import {
  SCORED_COMPLETENESS_FIELDS,
  type CompletenessFieldId,
  type ProductCompleteness,
} from '@/lib/productCompleteness';
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
  /**
   * The completeness score (S10), or omitted to draw no meter at all.
   *
   * Omitted for a BUNDLE and on CREATE, and both are decisions rather than oversights. A bundle has
   * no gallery to manage (§15.4), so a "needs a photo" row would name a control it does not have.
   * On create nothing exists yet: every row would read empty because the admin has not typed it,
   * which scolds them for not having finished a form they just opened. The caller decides; this
   * component only draws what it is given.
   */
  readonly completeness?: ProductCompleteness;
}

const EMPTY = '—';

/**
 * The editor's side rail (plan §4): the item's Status card, then the read-only "At a glance" rows.
 *
 * S1 shipped the summary alone because its contract was that no field moves. S2 brings §4's Status
 * toggles up here — `isActive` / `isAvailable` / `isSpecial` used to open the `Details` column, so
 * "is this item live?" was answered in the middle of a 150-control scroll, while the rail is the
 * one surface visible from every section. **S10 adds the third card, the completeness meter**, for
 * the same reason: "what is still missing on this item?" is a question about the whole page, so it
 * cannot live inside one section of it.
 *
 * What the meter scores, what it refuses to score, and why allergens are named rather than silently
 * dropped, all live in `@/lib/productCompleteness` — beside the rules, not beside the markup.
 *
 * Every "At a glance" row and every meter row stays READ-ONLY and derived from the form's own
 * values. The meter registers nothing and sends nothing: it cannot change the PUT payload.
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
  completeness,
}: EditorSideRailProps) {
  const { t } = useTranslation();

  // Literal `t()` calls, one per field: `check-t-keys.mjs` reads the CALLSITES statically, so a key
  // assembled as `t(`editor_completeness_${id}`)` is a key no gate can see.
  const fieldLabels: Record<CompletenessFieldId, string> = {
    photo: t('editor_completeness_photo'),
    // The shipped `description` key, deliberately reused: it already renders exactly "Description"
    // in all ten bundles, and a second key for one string is a drift source with nothing to gain.
    // `photo` has no such shipped key — no bundle carries the bare noun — so that one is new.
    description: t('description'),
  };

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
      {completeness && (
        <section className={styles.card} aria-labelledby="editor-completeness-heading">
          <h2 id="editor-completeness-heading" className={styles.heading}>
            {t('editor_completeness')}
          </h2>
          <p className={styles.progress}>
            {t('editor_completeness_progress', { done: completeness.done, total: completeness.total })}
          </p>
          <dl className={styles.list}>
            {SCORED_COMPLETENESS_FIELDS.map((id) => {
              const isMissing = completeness.missing.includes(id);
              return (
                <div key={id} className={styles.row}>
                  <dt className={styles.term}>
                    {/* Decoration only: the state is spelled out in the value beside it, so a
                        screen reader never has to interpret a tick. */}
                    <span aria-hidden="true" className={styles.glyph}>
                      {isMissing ? '○' : '✓'}
                    </span>
                    <span>{fieldLabels[id]}</span>
                  </dt>
                  <dd className={`${styles.value} ${isMissing ? styles.missing : ''}`}>
                    {isMissing ? t('editor_completeness_field_missing') : t('editor_completeness_field_done')}
                  </dd>
                </div>
              );
            })}
          </dl>
          {/*
            Allergens are NOT scored, and this line is the whole reason the meter can be trusted
            (plan §14, option 3). Saying nothing would read as "allergens are fine"; scoring an empty
            list as done would return a green tick at the exact moment nobody has looked, which is a
            claim about a regulated particular. It is plain copy, NOT `role="status"` — nothing has
            gone wrong and the text never changes, so a live region would announce nothing while
            telling every future reader that it does (§15.2).
          */}
          <p className={styles.note}>{t('editor_completeness_allergens_note')}</p>
        </section>
      )}
    </div>
  );
}
