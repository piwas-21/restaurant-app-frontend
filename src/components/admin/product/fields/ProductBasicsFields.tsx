import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Control, FieldErrors, FieldValues, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import type { Category } from '../types';
import { itemProductTypes } from '../types';
import CategoryChips from './CategoryChips';
import FieldError from './FieldError';
import { fieldAria, fieldDomId, fieldErrorId, fieldMessage } from './fieldAria';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import styles from './editorFields.module.css';

/** The `aria-describedby` target for the item-type select — see the section header. */
const TYPE_HELP_ID = 'product-type-help';
/** …and for the sentence that says what the stars on the chips do. */
const PRIMARY_HINT_ID = 'primary-category-hint';

interface ProductBasicsFieldsProps {
  // readonly: S6759 — component props are never mutated.
  readonly register: UseFormRegister<FieldValues>;
  readonly errors: FieldErrors<FieldValues>;
  readonly control: Control<FieldValues>;
  readonly setValue: UseFormSetValue<FieldValues>;
  readonly categories: Category[];
  /** Why `categories` is empty, when the fetch failed rather than the tenant having none. */
  readonly categoriesError?: string | null;
  readonly selectedCategoryIds: string[];
}

/**
 * Section 1 of the editor — **Basics**: what the item IS (plan §4, slice S2).
 *
 * **It used to ask three questions where there are two.** Tick the categories; then pick a PRIMARY
 * one again from a `<select>` that was disabled until you had, with a notice under it explaining
 * what happens if you skip it; and then, five sections away under a collapsed **Advanced**, choose a
 * product type. Three controls, one of them a re-statement of another and one of them filed by how
 * rarely it is touched rather than by what it is about.
 *
 * Now:
 *
 * - **The primary category is part of the chips.** Ticking the first one makes it primary; a star on
 *   each ticked chip moves it. The select is gone, and so is the notice — it existed because
 *   skipping was easy, and skipping was a separate act. `primaryCategoryId` is the same field on the
 *   same payload, so the command, its validator and the order-type inheritance are untouched.
 * - **The item type moved here from Advanced.** It is not a once-a-lifetime setting: it decides
 *   whether the guest sheet offers this item as a drink or a dessert in an upsell step
 *   (`groupSuggestedSideItems`) and whether the item is offered a drinks step of its own
 *   (`offersGenericDrinks`). Collapsed under Advanced with a default of `mainItem`, a tenant's drinks
 *   stayed typed as main items and the upsell grouped them wrongly, with nothing on screen saying so.
 *   It carries the sentence that says what it changes, which the select under Advanced never did.
 */
export default function ProductBasicsFields({
  register,
  errors,
  control,
  setValue,
  categories,
  categoriesError,
  selectedCategoryIds,
}: ProductBasicsFieldsProps) {
  const { t } = useTranslation();
  const categoriesMessage = fieldMessage(errors, 'categoryIds');
  /*
   * The primary's own refusal. The schema declares it twice — `min(1)` and a `.refine` that pins its
   * path here — and when the select left, its `FieldError` went with it, so unticking every category
   * refused the save, marked the section in the nav and explained itself NOWHERE on the page. That
   * is the one property this editor is built around: no field fails silently.
   */
  const primaryMessage = fieldMessage(errors, 'primaryCategoryId');

  return (
    <div className={modalStyles.formColumn}>
      <div className={`${modalStyles.formGroup} ${styles.group}`}>
        <label htmlFor={fieldDomId('name')}>{t('product_name')}</label>
        <input {...register('name')} {...fieldAria(errors, 'name')} />
        <FieldError name="name" message={fieldMessage(errors, 'name')} />
      </div>

      <div className={modalStyles.formGroup}>
        <label htmlFor={fieldDomId('description')}>{t('description')}</label>
        <textarea {...register('description')} {...fieldAria(errors, 'description')} rows={4} />
      </div>

      {/* fieldset+legend IS the grouping semantic for a set of checkboxes — a heading above a div
          cannot give the group a name or a group-level invalid state (S7). */}
      {/*
        Every id the group is described BY, joined — never written as separate attributes. A later
        JSX `aria-describedby` overrides an earlier one, which is how the code this replaces once
        wiped an error's describedby whenever the hint was absent; the hint is always present here,
        so the bug would have been the reverse and just as silent.
      */}
      <fieldset
        className={`${modalStyles.formGroup} ${styles.group} ${styles.fieldset}`}
        aria-invalid={categoriesMessage || primaryMessage ? 'true' : undefined}
        aria-describedby={[
          PRIMARY_HINT_ID,
          categoriesMessage ? fieldErrorId('categoryIds') : null,
          primaryMessage ? fieldErrorId('primaryCategoryId') : null,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <legend className={styles.legend}>{t('categories')}</legend>
        <CategoryChips
          control={control}
          setValue={setValue}
          categories={categories}
          selectedCategoryIds={selectedCategoryIds}
        />
        {/* An empty chip group means one of two things — this tenant has no categories, or the
            fetch failed — and the admin cannot tell them apart from the chips. Saying which is the
            difference between "create a category first" and "the list is stale, do not save yet". */}
        {categoriesError && (
          <p role="alert" data-testid="categories-load-error" className={modalStyles.errorMessage}>
            {categoriesError}
          </p>
        )}
        <FieldError name="categoryIds" message={categoriesMessage} />
        <FieldError name="primaryCategoryId" message={primaryMessage} />
        <p id={PRIMARY_HINT_ID} className={styles.hint}>
          {t('primary_category_hint')}
        </p>
      </fieldset>

      <div className={`${modalStyles.formGroup} ${styles.group}`}>
        <label htmlFor={fieldDomId('type')}>{t('product_type')}</label>
        <select id={fieldDomId('type')} aria-describedby={TYPE_HELP_ID} {...register('type')}>
          {itemProductTypes.map((type) => (
            <option key={type} value={type}>
              {t(`product_type_${type}`)}
            </option>
          ))}
        </select>
        <p id={TYPE_HELP_ID} className={styles.hint}>
          {t('product_type_help')}
        </p>
      </div>
    </div>
  );
}
