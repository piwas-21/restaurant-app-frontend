import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';
import FieldError from './FieldError';
import { fieldAria, fieldDomId, fieldMessage } from './fieldAria';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import styles from './editorFields.module.css';

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
 * `priceModifier` is measured against it. §4's grouping is the fix; S7 adds the label/invalid/
 * described-by wiring, and the currency affix the reference sheet draws is G10, still unowned.
 */
export default function ProductPricingFields({ register, errors }: ProductPricingFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className={`${modalStyles.formGroup} ${styles.group}`}>
      <label htmlFor={fieldDomId('basePrice')}>{t('base_price')}</label>
      <input type="number" step="0.01" {...register('basePrice')} {...fieldAria(errors, 'basePrice')} />
      <FieldError name="basePrice" message={fieldMessage(errors, 'basePrice')} />
    </div>
  );
}
