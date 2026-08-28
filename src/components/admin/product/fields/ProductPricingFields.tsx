import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';
import FieldError from './FieldError';
import { fieldAria, fieldDomId, fieldMessage } from './fieldAria';
import { TENANT_CURRENCY } from '@/utils/currency';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import styles from './editorFields.module.css';

interface ProductPricingFieldsProps {
  // readonly: S6759 — component props are never mutated.
  readonly register: UseFormRegister<FieldValues>;
  readonly errors: FieldErrors<FieldValues>;
}

const CURRENCY_ID = 'product-field-basePrice-currency';

/**
 * The money half of section 3 — **Pricing & variations** (plan §4, slice S2). The variation rows
 * are the existing `ProductVariations` and follow this block inside the same section.
 *
 * Base price led the old `Details` column, three sections away from the variations whose
 * `priceModifier` is measured against it. §4's grouping is the fix; S7 adds the label/invalid/
 * described-by wiring and, with it, conformance gap **G10** — the currency affix the reference
 * sheet draws inside the box (`admin_component_reference_sheet_dark_mode`, "Currency field").
 *
 * The affix is NOT `aria-hidden`. A currency drawn for sighted users and hidden from everyone else
 * is the same field announced as a bare number, so it is an `aria-describedby` target instead and
 * the control is heard as "Base Price … CHF". It comes from `TENANT_CURRENCY`, never a literal.
 */
export default function ProductPricingFields({ register, errors }: ProductPricingFieldsProps) {
  const { t } = useTranslation();
  // APPENDED, not replaced: `fieldAria` supplies the error id when there is one, and a plain
  // `aria-describedby` prop after the spread would silently drop it.
  const aria = fieldAria(errors, 'basePrice');
  const describedBy = [aria['aria-describedby'], CURRENCY_ID].filter(Boolean).join(' ');

  return (
    <div className={`${modalStyles.formGroup} ${styles.group}`}>
      <label htmlFor={fieldDomId('basePrice')}>{t('base_price')}</label>
      <span className={styles.affixBox}>
        <input
          type="number"
          step="0.01"
          className={styles.affixInput}
          {...register('basePrice')}
          {...aria}
          aria-describedby={describedBy}
        />
        <span id={CURRENCY_ID} className={styles.affix}>
          {TENANT_CURRENCY}
        </span>
      </span>
      <FieldError name="basePrice" message={fieldMessage(errors, 'basePrice')} />
    </div>
  );
}
