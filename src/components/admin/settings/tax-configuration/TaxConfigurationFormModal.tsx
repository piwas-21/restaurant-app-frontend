'use client';

import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { TaxConfiguration } from '@/services/adminTaxConfigurationService';
import { OrderType } from '@/types/order';
import type { TaxFormData } from './useTaxConfigurations';
import styles from '../TaxConfigurationManager.module.css';

interface TaxConfigurationFormModalProps {
  isOpen: boolean;
  editingConfig: TaxConfiguration | null;
  formData: TaxFormData;
  setFormData: Dispatch<SetStateAction<TaxFormData>>;
  rateInput: string;
  isRateValid: boolean;
  onRateChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}

export default function TaxConfigurationFormModal({
  isOpen,
  editingConfig,
  formData,
  setFormData,
  rateInput,
  isRateValid,
  onRateChange,
  onClose,
  onSubmit,
}: TaxConfigurationFormModalProps) {
  const { t } = useTranslation();

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>
            {editingConfig
              ? t('edit_tax_configuration', 'Edit Tax Configuration')
              : t('create_tax_configuration', 'Create Tax Configuration')}
          </h2>
          <button onClick={onClose} className={styles.closeButton}>
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="name">{t('name', 'Name')}</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('tax_name_placeholder', 'e.g., VAT, Sales Tax')}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="rate">{t('rate_percent', 'Rate (%)')}</label>
            <input
              id="rate"
              type="text"
              inputMode="decimal"
              value={rateInput}
              onChange={(e) => onRateChange(e.target.value)}
              placeholder={t('tax_rate_placeholder', 'e.g., 8.00')}
              className={!isRateValid ? styles.inputError : ''}
              required
            />
            {!isRateValid && (
              <small className={styles.errorText}>
                {t('rate_must_be_valid_number', 'Rate must be a valid number between 0 and 100')}
              </small>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">{t('description', 'Description')}</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('tax_description_placeholder', 'e.g., Standard VAT rate for Switzerland')}
              rows={3}
            />
          </div>

          <div className={styles.formGroup}>
            <label>{t('applicable_order_types', 'Applicable Order Types')}</label>
            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.applicableOrderTypes.includes(OrderType.DineIn)}
                  onChange={(e) => {
                    const types = e.target.checked
                      ? [...formData.applicableOrderTypes, OrderType.DineIn]
                      : formData.applicableOrderTypes.filter((t) => t !== OrderType.DineIn);
                    setFormData({ ...formData, applicableOrderTypes: types });
                  }}
                />
                <span>{t('dine_in_restaurant', 'Dine-In (Restaurant)')}</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.applicableOrderTypes.includes(OrderType.Takeaway)}
                  onChange={(e) => {
                    const types = e.target.checked
                      ? [...formData.applicableOrderTypes, OrderType.Takeaway]
                      : formData.applicableOrderTypes.filter((t) => t !== OrderType.Takeaway);
                    setFormData({ ...formData, applicableOrderTypes: types });
                  }}
                />
                <span>{t('takeaway_to_go', 'Takeaway (To Go)')}</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.applicableOrderTypes.includes(OrderType.Delivery)}
                  onChange={(e) => {
                    const types = e.target.checked
                      ? [...formData.applicableOrderTypes, OrderType.Delivery]
                      : formData.applicableOrderTypes.filter((t) => t !== OrderType.Delivery);
                    setFormData({ ...formData, applicableOrderTypes: types });
                  }}
                />
                <span>{t('delivery', 'Delivery')}</span>
              </label>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.isEnabled}
                onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
              />
              <span>{t('enable_this_tax_configuration', 'Enable this tax configuration')}</span>
            </label>
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              {t('cancel', 'Cancel')}
            </button>
            <button type="submit" className={styles.submitButton} disabled={!isRateValid || !rateInput}>
              {editingConfig ? t('update', 'Update') : t('create', 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
