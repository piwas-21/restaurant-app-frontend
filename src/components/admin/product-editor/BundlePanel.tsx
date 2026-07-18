'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';
import MenuScheduleEditor from '@/components/admin/menu-editor/MenuScheduleEditor';
import MenuSectionEditor from '@/components/admin/menu-editor/MenuSectionEditor';
import type { MenuDefinition } from '@/types/menu';
import styles from './ProductEditorPage.module.css';
import adminStyles from '@/app/styles/AdminPage.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface BundlePanelProps {
  // readonly: S6759 — component props are never mutated.
  readonly register: UseFormRegister<FieldValues>;
  readonly errors: FieldErrors<FieldValues>;
  readonly menuDefinition: MenuDefinition;
  readonly onChange: (menuDefinition: MenuDefinition) => void;
  readonly imageFiles: File[];
  readonly setImageFiles: (files: File[]) => void;
}

/**
 * Everything a bundle edits: its own core fields, when it is served, and what it contains.
 *
 * The fields are ported from `EditMenuBundleModal`, not composed from `ProductBasicInfo` /
 * `ProductDetails` — those carry item-only controls (categories, kitchen type, allergens, a
 * type chooser) that a bundle cannot support: `MenuBundleDto` returns none of that data, so
 * they would have nothing to seed from, and `editMenuBundleSchema` declares no such fields.
 * A bundle's categories survive precisely because the client never sends them (backend #192).
 */
export default function BundlePanel({
  register,
  errors,
  menuDefinition,
  onChange,
  imageFiles,
  setImageFiles,
}: BundlePanelProps) {
  const { t } = useTranslation();

  return (
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
              <input id="bundle-base-price" type="number" step="0.01" {...register('basePrice')} />
              {errors.basePrice && <p className={modalStyles.errorMessage}>{String(errors.basePrice.message)}</p>}
            </div>

            <div className={modalStyles.formGroup}>
              <label htmlFor="bundle-prep-time">{t('preparation_time_minutes')}</label>
              <input
                id="bundle-prep-time"
                type="number"
                min="0"
                step="1"
                {...register('preparationTimeMinutes')}
                placeholder="0"
              />
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

          <div className={modalStyles.formGroup}>
            <label htmlFor="bundle-images">
              {t('menu_image')} {t('optional')}
            </label>
            <input
              id="bundle-images"
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
            />
            {imageFiles.length > 0 && <p>{t('files_selected', { count: imageFiles.length })}</p>}
          </div>
        </div>
      </div>

      {/*
        No wrapper headings: both editors render their own <h3>. The modals wrapped them
        anyway, which printed "Menu Sections" twice and stacked "Menu Availability" above
        "Menu Availability Schedule".
      */}
      <section className={styles.panel}>
        <MenuScheduleEditor menuDefinition={menuDefinition} onChange={onChange} />
      </section>

      <section className={styles.panel}>
        {/*
          The section editor propagates every mutation to the page (owner call, slice 7):
          the page owns the single Save, so there is no nested commit point competing with it.
        */}
        <MenuSectionEditor
          sections={menuDefinition.sections}
          onChange={(sections) => onChange({ ...menuDefinition, sections })}
        />
      </section>
    </>
  );
}
