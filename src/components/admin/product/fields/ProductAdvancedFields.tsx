import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldValues, UseFormRegister } from 'react-hook-form';
import { productTypes } from '../types';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface ProductAdvancedFieldsProps {
  // readonly: S6759 — component props are never mutated.
  readonly register: UseFormRegister<FieldValues>;
}

/**
 * Section 7 — **Advanced**, the only section that is COLLAPSED by default (plan §4, D1).
 *
 * It holds the two item controls a restaurant touches once and then never again: the product type,
 * and `hideBaseProduct`. Both are still SENT on every save whether or not the card is open — the
 * shell hides a collapsed body with the `hidden` attribute rather than unmounting it, because a
 * field the form stops rendering is a field the PUT clears (plan §6).
 *
 * Neither control changes here. Dropping the `menu` option from the type select and making
 * `hideBaseProduct` conditional on there being a variation is D7, i.e. slice S8.
 */
export default function ProductAdvancedFields({ register }: ProductAdvancedFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className={modalStyles.formColumn}>
      <div className={modalStyles.formGroup}>
        <label>{t('product_type')}</label>
        <select {...register('type')}>
          {productTypes.map((type) => (
            <option key={type} value={type}>
              {t(`product_type_${type}`)}
            </option>
          ))}
        </select>
      </div>

      <div className={modalStyles.chipGroup}>
        {/* Only meaningful for a product that HAS variations; shown unconditionally until D7/S8. */}
        <div className={modalStyles.chip}>
          <input type="checkbox" id="product-hide-base" {...register('hideBaseProduct')} />
          <label htmlFor="product-hide-base">{t('hide_base_product')}</label>
        </div>
      </div>
    </div>
  );
}
