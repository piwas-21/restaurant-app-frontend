import React from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Control, FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';
import type { Category } from '../types';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface ProductBasicsFieldsProps {
  // readonly: S6759 — component props are never mutated.
  readonly register: UseFormRegister<FieldValues>;
  readonly errors: FieldErrors<FieldValues>;
  readonly control: Control<FieldValues>;
  readonly categories: Category[];
  /** Why `categories` is empty, when the fetch failed rather than the tenant having none. */
  readonly categoriesError?: string | null;
  readonly selectedCategoryIds: string[];
}

/**
 * Section 1 of the redesigned editor — **Basics**: what the item IS (plan §4, slice S2).
 *
 * Split out of `ProductBasicInfo`, whose fourth control was the kitchen-type selector. That one is
 * an *operational* setting and now lives in `Service & availability`, which is the whole point of
 * S2: this slice moves controls between sections and changes none of them. Every field below is
 * registered exactly as it was, so the payload is byte-identical.
 */
export default function ProductBasicsFields({
  register,
  errors,
  control,
  categories,
  categoriesError,
  selectedCategoryIds,
}: ProductBasicsFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className={modalStyles.formColumn}>
      <div className={modalStyles.formGroup}>
        <label>{t('product_name')}</label>
        <input {...register('name')} />
        {errors.name && <p className={modalStyles.errorMessage}>{errors.name.message as string}</p>}
      </div>

      <div className={modalStyles.formGroup}>
        <label>{t('description')}</label>
        <textarea {...register('description')} rows={4} />
      </div>

      <div className={modalStyles.formGroup}>
        <h3>{t('categories')}</h3>
        <Controller
          name="categoryIds"
          control={control}
          render={({ field }) => (
            <div className={modalStyles.chipGroup}>
              {categories.map((cat) => (
                <div key={cat.id} className={modalStyles.chip}>
                  <input
                    type="checkbox"
                    id={`category-chip-${cat.id}`}
                    value={cat.id}
                    checked={field.value?.includes(cat.id)}
                    onChange={(e) => {
                      const selectedIds = field.value || [];
                      field.onChange(
                        e.target.checked ? [...selectedIds, cat.id] : selectedIds.filter((id: string) => id !== cat.id),
                      );
                    }}
                  />
                  <label htmlFor={`category-chip-${cat.id}`}>{cat.name}</label>
                </div>
              ))}
            </div>
          )}
        />
        {/* An empty chip group means one of two things — this tenant has no categories, or the
            fetch failed — and the admin cannot tell them apart from the chips. Saying which is the
            difference between "create a category first" and "the list is stale, do not save yet". */}
        {categoriesError && (
          <p role="alert" data-testid="categories-load-error" className={modalStyles.errorMessage}>
            {categoriesError}
          </p>
        )}
        {errors.categoryIds && <p className={modalStyles.errorMessage}>{errors.categoryIds.message as string}</p>}
      </div>

      <div className={modalStyles.formGroup}>
        <label>{t('primary_category')}</label>
        <select {...register('primaryCategoryId')} disabled={!selectedCategoryIds || selectedCategoryIds.length === 0}>
          <option value="">{t('select_primary_category')}</option>
          {categories
            .filter((cat) => selectedCategoryIds?.includes(cat.id))
            .map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
        </select>
        {errors.primaryCategoryId && (
          <p className={modalStyles.errorMessage}>{errors.primaryCategoryId.message as string}</p>
        )}
      </div>
    </div>
  );
}
