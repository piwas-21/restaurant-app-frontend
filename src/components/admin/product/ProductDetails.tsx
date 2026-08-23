import React from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ProductDetailsProps, productTypes } from './types';
import styles from '@/app/styles/AdminPage.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import { AVAILABLE_ALLERGENS } from '@/lib/allergens';
import StagedImagePicker from './StagedImagePicker';

export const ProductDetails: React.FC<ProductDetailsProps> = ({
  register,
  errors,
  control,
  imageFiles,
  setImageFiles,
  showImagePicker = true,
}) => {
  const { t } = useTranslation();

  return (
    <div className={modalStyles.formColumn}>
      <div className={styles.grid}>
        <div className={modalStyles.formGroup}>
          <label>{t('base_price')}</label>
          <input type="number" step="0.01" {...register('basePrice')} />
          {errors.basePrice && <p className={modalStyles.errorMessage}>{errors.basePrice.message}</p>}
        </div>

        <div className={modalStyles.formGroup}>
          <label>{t('product_type')}</label>
          <select {...register('type')}>
            {productTypes.map((type) => (
              <option key={type} value={type}>
                {t(`product_type_${type}`)}
              </option>
            ))}
          </select>
        </div>

        <div className={modalStyles.formGroup}>
          <label>{t('preparation_time_minutes')}</label>
          <input type="number" min="0" step="1" {...register('preparationTimeMinutes')} placeholder="0" />
          {errors.preparationTimeMinutes && (
            <p className={modalStyles.errorMessage}>{errors.preparationTimeMinutes.message}</p>
          )}
        </div>

        <div className={modalStyles.chipGroup}>
          <div className={modalStyles.chip}>
            <input type="checkbox" id="product-active" {...register('isActive')} />
            <label htmlFor="product-active">{t('active')}</label>
          </div>
          <div className={modalStyles.chip}>
            <input type="checkbox" id="product-available" {...register('isAvailable')} />
            <label htmlFor="product-available">{t('available')}</label>
          </div>
          <div className={modalStyles.chip}>
            <input type="checkbox" id="product-special" {...register('isSpecial')} />
            <label htmlFor="product-special">{t('special_of_the_day_title')}</label>
          </div>
          {/* Only meaningful for a product that HAS variations, but shown unconditionally: the
              variations are edited further down the same form, so a chip that appeared and
              disappeared as rows were added would be the more confusing control. The base price
              above stays live either way — every variation price is derived from it. */}
          <div className={modalStyles.chip}>
            <input type="checkbox" id="product-hide-base" {...register('hideBaseProduct')} />
            <label htmlFor="product-hide-base">{t('hide_base_product')}</label>
          </div>
        </div>
      </div>

      {/* CREATE only (Track F, F7-B). A new product has no id yet and both image endpoints are
          sub-resources of /api/Products/{id}, so its images can only be STAGED and uploaded by
          the Save that creates the row. On EDIT this input is gone and the ImageGallery above
          the form owns upload as well as management — one image section, not two. */}
      {showImagePicker && (
        <StagedImagePicker
          inputId="product-images"
          label={t('product_images')}
          files={imageFiles}
          onChange={setImageFiles}
        />
      )}

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
    </div>
  );
};
