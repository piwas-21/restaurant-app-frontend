'use client';

import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
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

// No `if (!isOpen) return null` here — BaseModal owns mounting (renders null when
// closed). The children below are still constructed on every render, so they must
// stay safe when closed: `formData` is always defined and `editingConfig` is only
// read through ternaries (avoids the #93→#96 closed-children-eval crash).
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

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingConfig
          ? t('edit_tax_configuration', 'Edit Tax Configuration')
          : t('create_tax_configuration', 'Create Tax Configuration')
      }
    >
      <form onSubmit={onSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <FormField label={t('name', 'Name')}>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('tax_name_placeholder', 'e.g., VAT, Sales Tax')}
              required
            />
          </FormField>
        </div>

        <div className={styles.formGroup}>
          <FormField
            label={t('rate_percent', 'Rate (%)')}
            error={
              !isRateValid ? t('rate_must_be_valid_number', 'Rate must be a valid number between 0 and 100') : undefined
            }
          >
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
          </FormField>
        </div>

        <div className={styles.formGroup}>
          <FormField label={t('description', 'Description')}>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('tax_description_placeholder', 'e.g., Standard VAT rate for Switzerland')}
              rows={3}
            />
          </FormField>
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
    </BaseModal>
  );
}
