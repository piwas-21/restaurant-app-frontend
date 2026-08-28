import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldValues, UseFormRegister } from 'react-hook-form';
import { itemProductTypes } from '../types';
import { fieldDomId } from './fieldAria';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface ProductAdvancedFieldsProps {
  // readonly: S6759 — component props are never mutated.
  readonly register: UseFormRegister<FieldValues>;
  /**
   * Does this item have at least one variation? `hideBaseProduct` is inert without one, so the
   * control is hidden rather than offered — see below.
   */
  readonly hasVariations: boolean;
}

/**
 * Section 7 — **Advanced**, the only section that is COLLAPSED by default (plan §4, D1).
 *
 * It holds the two item controls a restaurant touches once and then never again: the product type,
 * and `hideBaseProduct`. Both are still SENT on every save whether or not the card is open — the
 * shell hides a collapsed body with the `hidden` attribute rather than unmounting it, because a
 * field the form stops rendering is a field the PUT clears (plan §6).
 *
 * **Slice S8 (D7) made both controls honest:**
 *
 * - The type select no longer offers `menu`. See `itemProductTypes` for why that option could not
 *   do what it appeared to offer, and why the zod enum deliberately still accepts the value.
 * - `hideBaseProduct` is hidden when the item has no variation. "Hide the base product" means
 *   "order this item through its variations instead", so with nothing to redirect to it is a switch
 *   that changes nothing: `isBaseRowHidden` (utils/baseProductVisibility.ts) already refuses to act
 *   on it unless an ACTIVE variation exists. The runtime was therefore already correct and the
 *   control was already inert — this only stops the editor claiming otherwise.
 *
 * HIDDEN, NEVER UNMOUNTED, and that is the same rule as everywhere else in this editor (plan §6):
 * an unmounted registered field is a value the PUT can clear. A product that has `hideBaseProduct`
 * true and later loses its variations must not have that column silently rewritten by the next
 * save — its variations may come back. `hidden` keeps the input registered and out of the tab order
 * at the same time, which a `display: none` wrapper would also do but a `visibility` one would not.
 *
 * S7 gave the type select the `htmlFor`/`id` pair its label was missing. It carries no
 * `aria-invalid`: an enum with a default cannot fail, which is also why
 * `editorValidation.focusField` does not force this collapsed body open.
 */
export default function ProductAdvancedFields({ register, hasVariations }: ProductAdvancedFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className={modalStyles.formColumn}>
      <div className={modalStyles.formGroup}>
        <label htmlFor={fieldDomId('type')}>{t('product_type')}</label>
        <select id={fieldDomId('type')} {...register('type')}>
          {itemProductTypes.map((type) => (
            <option key={type} value={type}>
              {t(`product_type_${type}`)}
            </option>
          ))}
        </select>
      </div>

      <div className={modalStyles.chipGroup} hidden={!hasVariations}>
        <div className={modalStyles.chip}>
          <input type="checkbox" id="product-hide-base" {...register('hideBaseProduct')} />
          <label htmlFor="product-hide-base">{t('hide_base_product')}</label>
        </div>
      </div>
    </div>
  );
}
