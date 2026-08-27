import React from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Control, FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';
import KitchenTypeSelector from '../KitchenTypeSelector';
import { KitchenType } from '@/types/menu';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface ProductServiceFieldsProps {
  // readonly: S6759 — component props are never mutated.
  readonly register: UseFormRegister<FieldValues>;
  readonly errors: FieldErrors<FieldValues>;
  readonly control: Control<FieldValues>;
}

/**
 * The operational half of section 6 — **Service & availability** (plan §4, slice S2): which station
 * prints the ticket, and how long the item takes. The order-type mask is the same section and
 * follows this block.
 *
 * Both controls used to live two sections apart — the kitchen type at the foot of `Basic info`, the
 * prep time in the middle of `Details` — even though they answer the same question: how the kitchen
 * serves this item. Rewriting `KitchenTypeSelector` in CSS Modules (it still carries inline hex) is
 * S8, and the inherited-value shape the approved screen draws is S5. S2 only moves them.
 */
export default function ProductServiceFields({ register, errors, control }: ProductServiceFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className={modalStyles.formGroup}>
        <Controller
          name="kitchenType"
          control={control}
          render={({ field }) => (
            <KitchenTypeSelector
              value={field.value as KitchenType | undefined}
              onChange={field.onChange}
              error={errors.kitchenType?.message as string | undefined}
            />
          )}
        />
      </div>

      <div className={modalStyles.formGroup}>
        <label>{t('preparation_time_minutes')}</label>
        <input type="number" min="0" step="1" {...register('preparationTimeMinutes')} placeholder="0" />
        {errors.preparationTimeMinutes && (
          <p className={modalStyles.errorMessage}>{errors.preparationTimeMinutes.message as string}</p>
        )}
      </div>
    </>
  );
}
