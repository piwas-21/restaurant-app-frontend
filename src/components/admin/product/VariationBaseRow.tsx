'use client';

import React from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Control, FieldValues } from 'react-hook-form';
import Switch from '@/components/design-system/Switch';
import { formatPlainCurrency } from '@/utils/currency';
import styles from './VariationBaseRow.module.css';
import rowStyles from './ProductIngredientRow.module.css';

interface VariationBaseRowProps {
  // readonly: S6759 — component props are never mutated.
  readonly control: Control<FieldValues>;
}

/**
 * The item itself, listed as the first row of its own variations table.
 *
 * A guest choosing a size sees the dish's own name at the top of the list ("Margherita Pizza") and
 * then the sizes under it — `VariationsSection` renders exactly that. The admin saw only the sizes,
 * and the switch that withholds the base row lived under **Advanced**, five sections away, labelled
 * "Hide base product". So the one list the guest reads was assembled from two screens, and the
 * control was phrased as the negative of what the admin was looking at.
 *
 * Here it is the same list, with the base row in it and an ACTIVE switch like every other row.
 * `hideBaseProduct` is inverted at this seam and nowhere else: on is orderable, off is withheld,
 * which is what the other switches in this table mean.
 *
 * **The name and price come from the FORM, not from the fetched product.** They are edited on this
 * very page — the base-price input is `ProductPricingFields`, rendered immediately above this table
 * in the same section — so reading the entity would print the stored number under an input showing
 * a different one, in the same viewport. Measured: typing 25.00 left this row reading CHF 18.50.
 *
 * **Not editable, and not reorderable.** Its name, description and price ARE the item's own,
 * already on this page in Basics and Pricing — a second input for them would be a second source of
 * truth for one value. Its position is fixed because the guest sheet renders it first and there is
 * no field to store any other answer; a reorder control here would be a promise nothing could keep.
 */
export default function VariationBaseRow({ control }: VariationBaseRowProps) {
  const { t } = useTranslation();
  const productName = (useWatch({ control, name: 'name' }) as string | undefined) ?? '';
  const basePrice = (useWatch({ control, name: 'basePrice' }) as number | undefined) ?? 0;

  return (
    <tr className={`${rowStyles.row} ${styles.baseRow}`}>
      {/* The reorder column, empty: see above. Not omitted — a missing cell would shift every
          following column out from under its own header. */}
      <td />
      <td className={styles.nameCell} data-label={t('variation_name')}>
        <div className={styles.nameField}>
          <span dir="auto" className={styles.name}>
            {productName}
          </span>
          <span className={styles.tag}>{t('variation_base_item')}</span>
        </div>
      </td>
      <td className={styles.hint} data-label={t('variation_description')}>
        {t('variation_base_item_hint')}
      </td>
      <td className={rowStyles.centerCell} data-label={t('price_modifier')}>
        {/* The base price itself, not a modifier: every modifier below is relative to this number,
            so printing "+0.00" here would state the relation and hide the quantity. */}
        {/* `formatPlainCurrency` already carries the currency — the sibling rows' modifier inputs
            wear a separate `TENANT_CURRENCY` affix because a bare number needs one, and printing
            both here read "CHF 12.00 CHF". */}
        <span className={styles.basePrice}>{formatPlainCurrency(basePrice)}</span>
      </td>
      <td className={rowStyles.centerCell} data-label={t('active')}>
        {/*
         * `Controller`, not `register`: the stored field is `hideBaseProduct` and the switch shows
         * its INVERSE, which `register` cannot express. The field stays registered whether or not
         * this row is drawn (see `ProductVariations`) — an unmounted registered field is a value the
         * PUT clears (MENU-ITEM-EDITOR-REDESIGN-PLAN §6).
         */}
        <Controller
          name="hideBaseProduct"
          control={control}
          render={({ field }) => (
            <Switch
              className={rowStyles.rowSwitch}
              label={t('variation_base_item_active')}
              srOnlyLabel
              id="variation-base-active"
              checked={!field.value}
              onChange={(event) => field.onChange(!event.target.checked)}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          )}
        />
      </td>
      {/* The actions column, empty: the item cannot be removed from its own list. */}
      <td />
    </tr>
  );
}
