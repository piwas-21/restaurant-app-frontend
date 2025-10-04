import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProductVariationsProps } from './types';
import styles from '@/app/styles/AdminPage.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

export const ProductVariations: React.FC<ProductVariationsProps> = ({
  register,
  variationFields,
  appendVariation,
  removeVariation
}) => {
  const { t } = useTranslation();

  return (
    <div className={modalStyles.formGroup}>
      <h3>{t('variations')} ({t('optional')})</h3>
      {variationFields.map((field, index) => (
        <div key={field.id} className={modalStyles.variationItem}>
          <button
            type="button"
            className={modalStyles.cancelButton}
            onClick={() => removeVariation(index)}
          >
            {t('remove')}
          </button>
          <div className={modalStyles.formGroup}>
            <label>{t('variation_name')}</label>
            <input {...register(`variations.${index}.name`)} />
          </div>
          <div className={modalStyles.formGroup}>
            <label>{t('variation_description')}</label>
            <input {...register(`variations.${index}.description`)} />
          </div>
          <div className={modalStyles.formGroup}>
            <label>{t('price_modifier')}</label>
            <input
              type="number"
              step="0.01"
              {...register(`variations.${index}.priceModifier`)}
            />
          </div>
          <div className={modalStyles.formGroup}>
            <label>{t('display_order')}</label>
            <input
              type="number"
              {...register(`variations.${index}.displayOrder`)}
            />
          </div>
          <div className={modalStyles.chipGroup}>
            <div className={modalStyles.chip}>
              <input
                type="checkbox"
                id={`variation-active-${index}`}
                {...register(`variations.${index}.isActive`)}
              />
              <label htmlFor={`variation-active-${index}`}>{t('active')}</label>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        className={`${styles.adminButton} ${modalStyles.addSectionButton}`}
        onClick={() => appendVariation({
          name: '',
          description: '',
          priceModifier: 0,
          displayOrder: variationFields.length,
          isActive: true
        })}
      >
        {t('add_variation')}
      </button>
    </div>
  );
};
