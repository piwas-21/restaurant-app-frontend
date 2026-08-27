import React from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Control, FieldValues } from 'react-hook-form';
import { AVAILABLE_ALLERGENS } from '@/lib/allergens';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface ProductAllergenFieldsProps {
  // readonly: S6759 — component props are never mutated.
  readonly control: Control<FieldValues>;
}

/**
 * The dietary half of section 5 — **Recipe & dietary** (plan §4, slice S2): the 16 allergen chips,
 * moved out of `Details` to sit under the ingredients they describe.
 *
 * The measured complaint was that "a user editing a price scrolls past 16 allergen chips to reach
 * it" (plan §1). Nothing here changed but the neighbourhood.
 */
export default function ProductAllergenFields({ control }: ProductAllergenFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className={modalStyles.formGroup}>
      <h3>
        {t('allergens')} {t('optional')}
      </h3>
      <Controller
        name="allergens"
        control={control}
        render={({ field }) => (
          <div className={modalStyles.chipGroup}>
            {AVAILABLE_ALLERGENS.map((allergen) => (
              <div key={allergen} className={modalStyles.chip}>
                <input
                  type="checkbox"
                  id={`allergen-chip-${allergen}`}
                  value={allergen}
                  checked={field.value?.includes(allergen)}
                  onChange={(e) => {
                    const selected = field.value || [];
                    field.onChange(
                      e.target.checked ? [...selected, allergen] : selected.filter((a: string) => a !== allergen),
                    );
                  }}
                />
                <label htmlFor={`allergen-chip-${allergen}`}>{t(`allergen_${allergen}`)}</label>
              </div>
            ))}
          </div>
        )}
      />
    </div>
  );
}
