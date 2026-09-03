'use client';

import React, { useEffect } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import type { Control, FieldValues, UseFormSetValue } from 'react-hook-form';
import type { Category } from '../types';
import styles from './CategoryChips.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface CategoryChipsProps {
  // readonly: S6759 — component props are never mutated.
  readonly control: Control<FieldValues>;
  readonly setValue: UseFormSetValue<FieldValues>;
  readonly categories: Category[];
  readonly selectedCategoryIds: string[];
}

/**
 * Which categories an item belongs to, and which of them is its PRIMARY — one control instead of
 * two.
 *
 * The editor used to ask twice: tick the categories, then pick one again from a `<select>` that was
 * disabled until you had. Two controls, one of them a re-statement of the other, plus a notice
 * explaining what happens if you answer the first and skip the second. That notice existed because
 * skipping was easy, and skipping was easy because the second control was a separate act.
 *
 * **The primary is now derived and then adjustable.** Ticking the first category makes it primary;
 * a star on each ticked chip moves it. Nothing to skip, nothing to leave empty, and the common case
 * — a dish in exactly one category — is answered by the tick that put it there.
 *
 * The FORM FIELD is unchanged: `primaryCategoryId` is still a string on the same payload, so the
 * command, the validator (*"Primary category must be one of the selected categories"*) and the
 * order-type inheritance that reads it are all untouched. What changed is how it is asked for.
 *
 * A radio group, not a second checkbox set, because exactly one category can be primary and the
 * radio's own semantics say so. The stars share one `name`, so a screen reader announces "Make
 * Pizzas the primary category, radio button, 1 of 2" — inside the CATEGORIES fieldset, whose legend
 * is the only group name in play; there is deliberately no second nested group, which would put two
 * names on one set of chips. The sentence explaining what the star does is the fieldset's
 * `aria-describedby` (`ProductBasicsFields`), so it is read with the group rather than merely
 * printed near it.
 *
 * The group has exactly ONE tab stop, because a checked radio always exists while any chip is
 * ticked — which is what makes the moving membership (stars appear and vanish as chips are ticked)
 * navigable rather than a shifting field of stops.
 */
export default function CategoryChips({ control, setValue, categories, selectedCategoryIds }: CategoryChipsProps) {
  const { t } = useTranslation();
  const primaryCategoryId = useWatch({ control, name: 'primaryCategoryId' });

  /**
   * Keep the primary inside the selection, and never leave it empty while there is a selection to
   * fill it from. Both directions matter: unticking the primary category used to leave a stale id
   * that the server then refused with "Primary category must be one of the selected categories" —
   * a save the admin could not complete from anything visible on screen.
   *
   * `shouldDirty` so the form knows the value moved; without it a save could carry the old id while
   * the chips show the new one. It does NOT dirty a pristine form on first paint: `useForm` gets
   * the defaults synchronously, so a saved primary is already in place before any effect runs and
   * neither branch fires. Verified in a browser (Save stayed disabled) as well as by
   * `ProductEditorRoundTrip`, whose fixture deliberately saves a primary that is NOT first.
   */
  useEffect(() => {
    // Normalised INSIDE the effect, not above it: `selectedCategoryIds ?? []` builds a fresh array
    // identity on every render when the prop is undefined, which would re-run this every render.
    const selected = selectedCategoryIds ?? [];
    if (selected.length === 0) {
      if (primaryCategoryId) setValue('primaryCategoryId', '', { shouldDirty: true });
      return;
    }
    if (!primaryCategoryId || !selected.includes(primaryCategoryId)) {
      setValue('primaryCategoryId', selected[0], { shouldDirty: true });
    }
  }, [selectedCategoryIds, primaryCategoryId, setValue]);

  return (
    <Controller
      name="categoryIds"
      control={control}
      render={({ field }) => (
        <div className={modalStyles.chipGroup}>
          {categories.map((category) => {
            const isSelected = field.value?.includes(category.id) ?? false;
            const isPrimary = isSelected && primaryCategoryId === category.id;
            return (
              <div key={category.id} className={styles.chip}>
                <div className={modalStyles.chip}>
                  <input
                    type="checkbox"
                    id={`category-chip-${category.id}`}
                    value={category.id}
                    checked={isSelected}
                    onChange={(event) => {
                      const ids: string[] = field.value || [];
                      field.onChange(
                        event.target.checked ? [...ids, category.id] : ids.filter((id) => id !== category.id),
                      );
                    }}
                    onBlur={field.onBlur}
                  />
                  <label htmlFor={`category-chip-${category.id}`}>{category.name}</label>
                </div>
                {/*
                 * Only on a TICKED chip: an item cannot be primarily in a category it is not in, and
                 * offering the star there would be a control whose click has to un-do itself.
                 */}
                {isSelected && (
                  <label className={`${styles.star} ${isPrimary ? styles.starOn : ''}`}>
                    <input
                      type="radio"
                      name="primary-category-star"
                      className={styles.starInput}
                      checked={isPrimary}
                      onChange={() => setValue('primaryCategoryId', category.id, { shouldDirty: true })}
                    />
                    <Star size={14} aria-hidden="true" fill={isPrimary ? 'currentColor' : 'none'} />
                    <span className="sr-only">{t('primary_category_of', { category: category.name })}</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
    />
  );
}
