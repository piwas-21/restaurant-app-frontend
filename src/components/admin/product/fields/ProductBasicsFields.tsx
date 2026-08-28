import React from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CircleAlert } from 'lucide-react';
import type { Control, FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';
import type { Category } from '../types';
import FieldError from './FieldError';
import { fieldAria, fieldDomId, fieldErrorId, fieldMessage } from './fieldAria';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import styles from './editorFields.module.css';

/** The consequence notice's DOM id — shared by the `<p>` and the select's `aria-describedby`. */
const PRIMARY_CONSEQUENCE_ID = 'primary-category-consequence';

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
 * S2: this slice moves controls between sections and changes none of them.
 *
 * S7 wires the accessibility half of every control here: a label that points at its input, an
 * `aria-invalid` the assistive tree can read, and an `aria-describedby` from the input to the
 * sentence explaining it. The category CHIPS become a real `fieldset`/`legend` — a group of
 * checkboxes needs a group name and a group-level invalid state, which a `<h3>` above a `<div>`
 * cannot give. No field is added, renamed or re-registered.
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
  const categoriesMessage = fieldMessage(errors, 'categoryIds');
  /*
   * D8 (S10): the consequence of leaving Primary category empty, shown AT THE CAUSE.
   *
   * The sentence itself is not new — `ProductOrderTypes.tsx:103-110` has said it since the
   * order-type work. What was wrong is WHERE: it renders in `Service & availability`, five sections
   * below the empty select that causes it, so an admin who never scrolls there never learns why
   * their item is orderable on every channel. This is the notice the approved screen draws under
   * this control (conformance gap G14's notice half); the one downstream stays exactly as it is,
   * because that is where the effect actually lands.
   */
  const primaryCategoryId = useWatch({ control, name: 'primaryCategoryId' });
  const hasCategories = (selectedCategoryIds?.length ?? 0) > 0;
  // Only once a category has been TICKED. Before that the select is disabled and empty by
  // construction, so the notice would be scolding the admin for not having reached the field yet.
  const showNoPrimaryConsequence = hasCategories && !primaryCategoryId;

  /*
   * The notice explains this control, so it has to DESCRIBE it — otherwise a screen-reader user
   * hears the label and the options and never the consequence of leaving it empty.
   *
   * Merged rather than passed as a second `aria-describedby` prop: a later JSX attribute WINS over
   * a spread one, so `aria-describedby={undefined}` written after `{...fieldAria(...)}` would have
   * silently wiped the ERROR describedby whenever there was an error and no notice. The two ids are
   * joined instead, which is also the correct answer if they ever do coexist.
   */
  const primaryCategoryAria = (() => {
    const base = fieldAria(errors, 'primaryCategoryId');
    if (!showNoPrimaryConsequence) return base;
    return {
      ...base,
      'aria-describedby': [base['aria-describedby'], PRIMARY_CONSEQUENCE_ID].filter(Boolean).join(' '),
    };
  })();

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

      <fieldset
        className={`${modalStyles.formGroup} ${styles.group} ${styles.fieldset}`}
        aria-invalid={categoriesMessage ? 'true' : undefined}
        aria-describedby={categoriesMessage ? fieldErrorId('categoryIds') : undefined}
      >
        <legend className={styles.legend}>{t('categories')}</legend>
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
                    onBlur={field.onBlur}
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
        <FieldError name="categoryIds" message={categoriesMessage} />
      </fieldset>

      <div className={`${modalStyles.formGroup} ${styles.group}`}>
        <label htmlFor={fieldDomId('primaryCategoryId')}>{t('primary_category')}</label>
        <select
          {...register('primaryCategoryId')}
          {...primaryCategoryAria}
          disabled={!selectedCategoryIds || selectedCategoryIds.length === 0}
        >
          <option value="">{t('select_primary_category')}</option>
          {categories
            .filter((cat) => selectedCategoryIds?.includes(cat.id))
            .map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
        </select>
        <FieldError name="primaryCategoryId" message={fieldMessage(errors, 'primaryCategoryId')} />
        {showNoPrimaryConsequence && (
          <p id={PRIMARY_CONSEQUENCE_ID} className={styles.consequence}>
            <CircleAlert size={16} className={styles.consequenceIcon} aria-hidden="true" />
            {t('editor_no_primary_category_consequence')}
          </p>
        )}
      </div>
    </div>
  );
}
