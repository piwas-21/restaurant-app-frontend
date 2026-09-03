'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import VariationBaseRow from './VariationBaseRow';
import VariationLibraryButton from './VariationLibraryButton';
import { nextVariationDisplayOrder } from './globalVariationLibrary';
import { ProductVariationsProps } from './types';
import FieldError from './fields/FieldError';
import { fieldAria, fieldMessage } from './fields/fieldAria';
import RowMoveButtons from './RowMoveButtons';
import { SIGNED_MONEY_INPUT_PROPS } from './numberInputProps';
import Switch from '@/components/design-system/Switch';
import { TENANT_CURRENCY } from '@/utils/currency';
import groupStyles from './IngredientGroup.module.css';
import rowStyles from './ProductIngredientRow.module.css';

/**
 * Variations as the compact table the approved screen draws
 * (`docs/stitch-screens/admin-menu/pricing_variations_detail_margherita_pizza`; frontend #576 / gap
 * G9): NAME · DESCRIPTION · PRICE MODIFIER · ACTIVE, one row each, with the currency affixed. It
 * used to be full-width stacked blocks with four vertical fields.
 *
 * Since slice S4 it carries NO translation controls. It used to hold a disclosure per row opening a
 * name AND a description input for every one of the ten locales — twenty registrations per
 * variation, live whether or not the panel was ever opened — beside a `Translated in 3 of 10
 * languages` readout. Both are gone: the grid was one of the three rival translation UIs D2
 * replaced with the Translations tab, and the readout counted `variationFields`, a `useFieldArray`
 * SNAPSHOT that no `setValue` refreshes — so it never moved as translations were typed, in the old
 * panel or the new tab. The rail in the Translations tab answers the same question and stays live.
 *
 * It shares the ingredient table's stylesheets on purpose — the two tables sit in adjacent sections
 * of one page and the screens draw them identically, so a second copy of the same rules is a second
 * thing to keep in step.
 *
 * **Two fields lost their input here and NEITHER lost its value** — `displayOrder`, which the
 * screen does not draw, and now `content`, which the Translations tab owns. Both survive because
 * react-hook-form submits its own store: a default seeded from the fetched product is in it whether
 * or not an input is mounted, exactly how `variations[].id` has always round-tripped, having never
 * had an input at all. That is the trap this editor is most likely to spring — a field absent from
 * the visible form that the PUT then clears — so `ProductEditorRoundTrip` asserts all three.
 *
 * DEVIATION, the same one the recipe table makes: the screen draws a DRAG handle on every row and
 * this draws two buttons (`RowMoveButtons`, shared between the two tables, states why). Reordering
 * is real as of #593 — `moveVariation` swaps the rows and RENUMBERS `displayOrder`, which is what
 * every consumer sorts by and what no input on this screen exposes.
 */
export const ProductVariations: React.FC<ProductVariationsProps> = ({
  register,
  errors,
  variationFields,
  appendVariation,
  removeVariation,
  moveVariation,
  getValues,
  control,
}) => {
  const { t } = useTranslation();

  return (
    <section className={groupStyles.group}>
      <h3 className={groupStyles.title}>
        {t('variations')} {t('optional')}
      </h3>

      {variationFields.length === 0 ? (
        <>
          <p className={groupStyles.emptyState}>{t('no_variations_added')}</p>
          {/*
           * REGISTERED, never unmounted (plan §6): a registered field the form stops rendering is a
           * value the PUT clears, and an item that hides its base row and then loses its variations
           * must not have that column silently rewritten — its variations may come back.
           * `isBaseRowHidden` already degrades the flag to false while nothing is active, so the
           * runtime is right either way; this only stops the SAVE from lying.
           */}
          <input type="checkbox" hidden {...register('hideBaseProduct')} />
        </>
      ) : (
        <table className={groupStyles.table}>
          <thead>
            <tr>
              {/* Empty on purpose: the reorder column's names are on its two buttons, and a title
                  for a pair of chevrons is noise in a table this narrow. */}
              <th />
              <th scope="col">{t('variation_name')}</th>
              <th scope="col">{t('variation_description')}</th>
              <th scope="col">{t('price_modifier')}</th>
              <th scope="col">{t('active')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {/* The item itself, first, exactly where the guest sheet draws it. Its ACTIVE switch is
                `hideBaseProduct`, which used to live under Advanced five sections away and phrased
                as the negative — so the one list a guest reads was assembled from two screens. */}
            <VariationBaseRow control={control} />
            {variationFields.map((field, index) => (
              <tr key={field.id} className={rowStyles.row}>
                <RowMoveButtons
                  index={index}
                  canMoveUp={index > 0}
                  canMoveDown={index < variationFields.length - 1}
                  onMove={moveVariation}
                />
                <td className={rowStyles.nameCell} data-label={t('variation_name')}>
                  <input
                    className={rowStyles.nameInput}
                    aria-label={t('variation_name')}
                    placeholder={t('variation_name')}
                    {...register(`variations.${index}.name`)}
                    {...fieldAria(errors, `variations.${index}.name`)}
                  />
                  {/* S7/D13. `variationSchema.name` is `min(1)`, so a blank one refuses the
                        WHOLE save — and until S7 this file rendered no message at all, which is
                        why the editor could refuse with nothing on screen anywhere (plan §12.1).
                        The `aria-label` above stays: it is the accessible NAME, and `fieldAria`
                        only adds the invalid state and the pointer to this sentence. */}
                  <FieldError
                    name={`variations.${index}.name`}
                    message={fieldMessage(errors, `variations.${index}.name`)}
                  />
                </td>
                <td className={rowStyles.nameCell} data-label={t('variation_description')}>
                  <input
                    className={rowStyles.nameInput}
                    aria-label={t('variation_description')}
                    placeholder={t('variation_description')}
                    {...register(`variations.${index}.description`)}
                    {...fieldAria(errors, `variations.${index}.description`)}
                  />
                  {/* The other half of the same defect the name input's message closed, and the one
                      that actually bit production: a variation loaded with `description: null`
                      failed the resolver here, this cell drew nothing, and the whole form refused
                      to save with no sentence anywhere on the page. The schema now accepts null
                      (`optionalText` in schemas.ts), so this is defence in depth — no field in this
                      table may fail silently again. */}
                  <FieldError
                    name={`variations.${index}.description`}
                    message={fieldMessage(errors, `variations.${index}.description`)}
                  />
                </td>
                <td className={rowStyles.centerCell} data-label={t('price_modifier')}>
                  <span className={rowStyles.priceField}>
                    {/* SIGNED, not `MONEY_INPUT_PROPS`: a *Small* is priced below the base item,
                          so this is legitimately negative and a `min="0"` would have the browser
                          refuse a value the schema, the API and the menu all accept. */}
                    <input
                      {...SIGNED_MONEY_INPUT_PROPS}
                      aria-label={t('price_modifier')}
                      {...register(`variations.${index}.priceModifier`)}
                      {...fieldAria(errors, `variations.${index}.priceModifier`)}
                    />
                    <span className={rowStyles.currency}>{TENANT_CURRENCY}</span>
                  </span>
                  <FieldError
                    name={`variations.${index}.priceModifier`}
                    message={fieldMessage(errors, `variations.${index}.priceModifier`)}
                  />
                </td>
                <td className={rowStyles.centerCell} data-label={t('active')}>
                  <Switch
                    className={rowStyles.rowSwitch}
                    label={t('active')}
                    srOnlyLabel
                    id={`variation-active-${index}`}
                    {...register(`variations.${index}.isActive`)}
                  />
                </td>
                <td className={rowStyles.centerCell} data-label={t('actions')}>
                  <button
                    type="button"
                    className={rowStyles.removeButton}
                    aria-label={t('remove')}
                    onClick={() => removeVariation(index)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={groupStyles.actions}>
        <button
          type="button"
          className={groupStyles.addButton}
          onClick={() =>
            appendVariation({
              name: '',
              description: '',
              priceModifier: 0,
              // NOT `variationFields.length`, which is what this said before and what my own
              // picker said until #593 landed underneath it. `useVariationReorder` documents that
              // live `displayOrder` holds gaps and duplicates, so the row COUNT can name an order
              // another row already occupies — and `getValues` is read rather than
              // `variationFields` because a reorder renumbers through `setValue`, which never
              // refreshes the field-array snapshot. Both buttons now agree where a new row lands.
              displayOrder: nextVariationDisplayOrder(getValues('variations')),
              isActive: true,
              content: {},
            })
          }
        >
          <Plus size={16} aria-hidden="true" />
          {t('add_variation')}
        </button>
        {/* Plan S4, beside the blank-row button rather than instead of it: a size the library does
            not carry still has to be typeable. */}
        <VariationLibraryButton getValues={getValues} appendVariation={appendVariation} />
      </div>
    </section>
  );
};
