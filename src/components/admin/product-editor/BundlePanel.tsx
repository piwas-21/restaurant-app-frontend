'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Control, FieldErrors, FieldValues, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import CategoryChips from '@/components/admin/product/fields/CategoryChips';
import type { Category } from '@/components/admin/product/types';
import MenuScheduleEditor from '@/components/admin/menu-editor/MenuScheduleEditor';
import MenuSectionEditor from '@/components/admin/menu-editor/MenuSectionEditor';
import ProductAllergenFields from '@/components/admin/product/fields/ProductAllergenFields';
import { INTEGER_INPUT_PROPS, MONEY_INPUT_PROPS } from '@/components/admin/product/numberInputProps';
import type { ItemAvailability, MenuDefinition } from '@/types/menu';
import BundleGuestStepPreview from './BundleGuestStepPreview';
import styles from './ProductEditorPage.module.css';
import adminStyles from '@/app/styles/AdminPage.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface BundlePanelProps {
  readonly section: 'basics' | 'options' | 'service';
  readonly register: UseFormRegister<FieldValues>;
  readonly errors: FieldErrors<FieldValues>;
  readonly control: Control<FieldValues>;
  readonly setValue: UseFormSetValue<FieldValues>;
  readonly categories: Category[];
  readonly categoriesError?: string | null;
  readonly selectedCategoryIds: string[];
  readonly menuDefinition: MenuDefinition;
  readonly availability?: ItemAvailability;
  readonly productId: string;
  readonly isDirty: boolean;
  readonly isActive: boolean;
  readonly isAvailable: boolean;
  readonly onChange: (menuDefinition: MenuDefinition) => void;
}

/** Bundle fields stay mounted in focused sections and submit through the page's single Save. */
export default function BundlePanel({
  section,
  register,
  errors,
  control,
  setValue,
  categories,
  categoriesError,
  selectedCategoryIds,
  menuDefinition,
  availability,
  productId,
  isDirty,
  isActive,
  isAvailable,
  onChange,
}: BundlePanelProps) {
  const { t } = useTranslation();

  return (
    <>
      {section === 'basics' && (
        <>
          <div className={modalStyles.formGrid}>
            <div className={modalStyles.formColumn}>
              <div className={modalStyles.formGroup}>
                <label htmlFor="bundle-name">{t('menu_bundle_name')}</label>
                <input id="bundle-name" {...register('name')} placeholder={t('enter_menu_bundle_name')} />
                {errors.name && <p className={modalStyles.errorMessage}>{String(errors.name.message)}</p>}
              </div>

              <div className={modalStyles.formGroup}>
                <label htmlFor="bundle-description">{t('description')}</label>
                <textarea id="bundle-description" {...register('description')} rows={4} />
                {errors.description && <p className={modalStyles.errorMessage}>{String(errors.description.message)}</p>}
              </div>
            </div>

            <div className={modalStyles.formColumn}>
              <div className={adminStyles.grid}>
                <div className={modalStyles.formGroup}>
                  <label htmlFor="bundle-base-price">{t('base_price')}</label>
                  {/* The same two constants the item panel uses (S8). A bundle's price is a price and
                  its prep time is a count; two panels of one editor spelling that differently is
                  exactly the drift `numberInputProps.ts` exists to end. */}
                  <input id="bundle-base-price" {...register('basePrice')} {...MONEY_INPUT_PROPS} />
                  {errors.basePrice && <p className={modalStyles.errorMessage}>{String(errors.basePrice.message)}</p>}
                </div>

                <div className={modalStyles.chipGroup}>
                  <div className={modalStyles.chip}>
                    <input type="checkbox" id="bundle-active" {...register('isActive')} />
                    <label htmlFor="bundle-active">{t('active')}</label>
                  </div>
                  <div className={modalStyles.chip}>
                    <input type="checkbox" id="bundle-available" {...register('isAvailable')} />
                    <label htmlFor="bundle-available">{t('available')}</label>
                  </div>
                  <div className={modalStyles.chip}>
                    <input type="checkbox" id="bundle-special" {...register('isSpecial')} />
                    <label htmlFor="bundle-special">{t('special_of_the_day_title')}</label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <fieldset className={modalStyles.formGroup} aria-describedby="bundle-primary-category-hint">
            <legend>{t('categories')}</legend>
            <p id="bundle-primary-category-hint">{t('bundle_primary_category_hint')}</p>
            <CategoryChips
              control={control}
              setValue={setValue}
              categories={categories}
              selectedCategoryIds={selectedCategoryIds}
            />
            {categoriesError && (
              <p className={modalStyles.errorMessage} role="alert">
                {categoriesError}
              </p>
            )}
            {errors.categoryIds && <p className={modalStyles.errorMessage}>{String(errors.categoryIds.message)}</p>}
          </fieldset>
        </>
      )}

      {section === 'service' && (
        <>
          <div className={modalStyles.formGroup}>
            <label htmlFor="bundle-prep-time">{t('preparation_time_minutes')}</label>
            <input
              id="bundle-prep-time"
              {...register('preparationTimeMinutes')}
              {...INTEGER_INPUT_PROPS}
              placeholder="0"
            />
          </div>
          <section className={styles.panel}>
            <MenuScheduleEditor menuDefinition={menuDefinition} onChange={onChange} />
          </section>
        </>
      )}

      {section === 'options' && (
        <>
          <section className={styles.panel}>
            {/*
          The section editor propagates every mutation to the page (owner call, slice 7):
          the page owns the single Save, so there is no nested commit point competing with it.
        */}
            <MenuSectionEditor
              sections={menuDefinition.sections}
              onChange={(sections) => onChange({ ...menuDefinition, sections })}
            />
            <BundleGuestStepPreview
              menuDefinition={menuDefinition}
              availability={availability}
              quoteContext={{ productId, isDirty, isActive, isAvailable }}
            />
            {errors.menuDefinition && (
              <p className={modalStyles.errorMessage} role="alert">
                {String(errors.menuDefinition.message || t('menu_definition_invalid'))}
              </p>
            )}
          </section>

          <section className={styles.panel}>
            <ProductAllergenFields control={control} />
          </section>
        </>
      )}
    </>
  );
}
