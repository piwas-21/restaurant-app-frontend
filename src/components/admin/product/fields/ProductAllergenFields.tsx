import React from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Control, FieldValues } from 'react-hook-form';
import { AVAILABLE_ALLERGENS } from '@/lib/allergens';
import { ALLERGEN_CHIP_ICONS, ALLERGEN_NONE_ICON } from './allergenChipIcons';
import styles from './ProductAllergenFields.module.css';

interface ProductAllergenFieldsProps {
  // readonly: S6759 — component props are never mutated.
  readonly control: Control<FieldValues>;
}

/**
 * The dietary half of section 5 — **Recipe & dietary** (plan §4, slice S2): the 16 allergen chips,
 * moved out of `Details` to sit under the ingredients they describe.
 *
 * Skinned to `recipe_dietary_details_margherita_pizza` by the cosmetic conformance batch
 * (review gap **G13**, frontend #581): every chip carries a glyph, the group has a `Clear all`
 * action on its heading row, and there is a `None` chip.
 *
 * ### `None` is a VIEW of the empty list, not a new value — and that distinction is the honest part
 *
 * `allergens` is a `string[]`. The schema cannot tell *"the kitchen declares no allergens"* from
 * *"nobody has filled this in yet"*, and this component does not invent a third state to pretend
 * otherwise: the `None` chip is **pressed when the list is empty** and pressing it empties the list.
 * It makes the empty state legible and reachable in one click; it does not record a claim.
 *
 * Making that a real declaration needs a field on the product, and the place that difference
 * actually pays is the completeness meter — *"this item has no allergen information"* versus
 * *"this item is declared allergen-free"* — which is **S10**. Until then `None` is a control, not a
 * datum, and it is marked `aria-pressed` rather than dressed as a checkbox for exactly that reason.
 */
export default function ProductAllergenFields({ control }: ProductAllergenFieldsProps) {
  const { t } = useTranslation();
  const NoneIcon = ALLERGEN_NONE_ICON;

  return (
    <div className={styles.group}>
      <Controller
        name="allergens"
        control={control}
        render={({ field }) => {
          const selected: string[] = field.value || [];
          const isEmpty = selected.length === 0;

          return (
            <>
              <div className={styles.head}>
                <h3 className={styles.heading}>
                  {t('allergens')} <span className={styles.optional}>{t('optional')}</span>
                </h3>
                <button type="button" className={styles.clearAll} onClick={() => field.onChange([])} disabled={isEmpty}>
                  {t('allergens_clear_all')}
                </button>
              </div>

              <div className={styles.chips}>
                {AVAILABLE_ALLERGENS.map((allergen) => {
                  const Icon = ALLERGEN_CHIP_ICONS[allergen];
                  const isOn = selected.includes(allergen);
                  return (
                    <div key={allergen} className={`${styles.chip} ${isOn ? styles.chipOn : ''}`}>
                      <input
                        type="checkbox"
                        className={styles.chipInput}
                        id={`allergen-chip-${allergen}`}
                        value={allergen}
                        checked={isOn}
                        onChange={(event) =>
                          field.onChange(
                            event.target.checked
                              ? [...selected, allergen]
                              : selected.filter((value: string) => value !== allergen),
                          )
                        }
                      />
                      <label className={styles.chipLabel} htmlFor={`allergen-chip-${allergen}`}>
                        {/* Decorative: the label beside it already names the allergen, so announcing
                            the glyph would say it twice. */}
                        {Icon && <Icon size={14} aria-hidden="true" className={styles.chipIcon} />}
                        {t(`allergen_${allergen}`)}
                      </label>
                    </div>
                  );
                })}

                {/* Not a 17th checkbox: it holds no value (see the doc comment). A toggle button
                    with `aria-pressed` says "this is a control reflecting a state", which is what it
                    is, and keeps it out of the checkbox group a screen reader reads as the answer. */}
                <button
                  type="button"
                  data-testid="allergen-chip-none"
                  className={`${styles.chip} ${styles.chipButton} ${isEmpty ? styles.chipOn : ''}`}
                  aria-pressed={isEmpty}
                  onClick={() => field.onChange([])}
                >
                  <NoneIcon size={14} aria-hidden="true" className={styles.chipIcon} />
                  {t('allergens_none')}
                </button>
              </div>
            </>
          );
        }}
      />
    </div>
  );
}
