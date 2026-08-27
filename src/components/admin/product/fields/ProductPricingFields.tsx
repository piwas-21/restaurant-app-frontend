import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface ProductPricingFieldsProps {
  // readonly: S6759 — component props are never mutated.
  readonly register: UseFormRegister<FieldValues>;
  readonly errors: FieldErrors<FieldValues>;
}

/**
 * The money half of section 3 — **Pricing & variations** (plan §4, slice S2). The variation rows
 * are the existing `ProductVariations` and follow this block inside the same section.
 *
 * Base price led the old `Details` column, three sections away from the variations whose
 * `priceModifier` is measured against it. §4's grouping is the fix; the input itself is unchanged.
 */
export default function ProductPricingFields({ register, errors }: ProductPricingFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className={modalStyles.formGroup}>
      <label>{t('base_price')}</label>
      <input type="number" step="0.01" {...register('basePrice')} />
      {errors.basePrice && <p className={modalStyles.errorMessage}>{errors.basePrice.message as string}</p>}
    </div>
  );
}
