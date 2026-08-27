import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldValues, UseFormRegister } from 'react-hook-form';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import styles from './ProductStatusFields.module.css';

interface ProductStatusFieldsProps {
  // readonly: S6759 — component props are never mutated.
  readonly register: UseFormRegister<FieldValues>;
}

/**
 * The item's three status flags, in the side rail where §4 draws them (slice S2).
 *
 * They were the first thing in the old `Details` column, which is why "is this item live?" was
 * answered in the middle of a 150-control scroll. The rail is the one surface visible from every
 * section, so that is where the answer belongs.
 *
 * Two consequences worth knowing before moving them again:
 * - the rail is now a form surface, so `EditorShell` HIDES it on the Translations tab instead of
 *   unmounting it. A registered input that unmounts is a value the PUT can clear (plan §6).
 * - the rail sits outside the `<form>` element (it is a sibling of the main column), which is safe
 *   for exactly the reason §8.2 gives for the translations panel: react-hook-form submits its own
 *   store, not the DOM tree under the form.
 *
 * A bundle keeps its own three flags inside `BundlePanel` — `MenuBundleDto` is a different shape
 * and S2 does not restructure it.
 */
export default function ProductStatusFields({ register }: ProductStatusFieldsProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.card} aria-labelledby="editor-rail-status-heading">
      <h2 id="editor-rail-status-heading" className={styles.heading}>
        {t('status')}
      </h2>
      <div className={styles.rows}>
        <div className={modalStyles.chip}>
          <input type="checkbox" id="product-active" {...register('isActive')} />
          <label htmlFor="product-active">{t('active')}</label>
        </div>
        <div className={modalStyles.chip}>
          <input type="checkbox" id="product-available" {...register('isAvailable')} />
          <label htmlFor="product-available">{t('available')}</label>
        </div>
        <div className={modalStyles.chip}>
          <input type="checkbox" id="product-special" {...register('isSpecial')} />
          <label htmlFor="product-special">{t('special_of_the_day_title')}</label>
        </div>
      </div>
    </section>
  );
}
