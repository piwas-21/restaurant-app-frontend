'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { CustomerDiscountFormData } from '@/utils/customerDiscountForm';
import styles from '../CustomerDiscountForm.module.css';

interface CustomerDiscountFieldsProps {
  formData: CustomerDiscountFormData;
  loading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

/**
 * The discount configuration fields (type/value, min/max order, validity dates, usage limit,
 * active) of CustomerDiscountForm. Extracted verbatim from CustomerDiscountForm (Sprint 6
 * god-file decomposition).
 */
export default function CustomerDiscountFields({ formData, loading, onChange }: CustomerDiscountFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label htmlFor="discountType">
            {t('discount_type', 'Discount Type')} <span className={styles.required}>*</span>
          </label>
          <select
            id="discountType"
            name="discountType"
            value={formData.discountType}
            onChange={onChange}
            disabled={loading}
            className={styles.select}
          >
            <option value="Percentage">{t('percentage', 'Percentage')}</option>
            <option value="FixedAmount">{t('fixed_amount', 'Fixed Amount')}</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="discountValue">
            {t('discount_value', 'Discount Value')} <span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            inputMode="decimal"
            id="discountValue"
            name="discountValue"
            value={formData.discountValue}
            onChange={onChange}
            disabled={loading}
            className={styles.input}
            placeholder={formData.discountType === 'Percentage' ? '10' : '5.00'}
          />
          <small className={styles.help}>
            {formData.discountType === 'Percentage'
              ? t('enter_percentage_0_100', 'Enter percentage (0-100)')
              : t('enter_chf_amount', 'Enter CHF amount')}
          </small>
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label htmlFor="minOrderAmount">{t('minimum_order_amount', 'Minimum Order Amount')}</label>
          <input
            type="text"
            inputMode="decimal"
            id="minOrderAmount"
            name="minOrderAmount"
            value={formData.minOrderAmount}
            onChange={onChange}
            disabled={loading}
            className={styles.input}
            placeholder="0.00"
          />
        </div>

        <div className={styles.formGroup}>
          <label>
            <input
              type="checkbox"
              name="hasMaxOrderAmount"
              checked={formData.hasMaxOrderAmount}
              onChange={onChange}
              disabled={loading}
              className={styles.checkbox}
            />
            {t('set_maximum_order_amount', 'Set Maximum Order Amount')}
          </label>
          {formData.hasMaxOrderAmount && (
            <input
              type="text"
              inputMode="decimal"
              name="maxOrderAmount"
              value={formData.maxOrderAmount}
              onChange={onChange}
              disabled={loading}
              className={styles.input}
              placeholder="100.00"
            />
          )}
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label>
            <input
              type="checkbox"
              name="hasValidFrom"
              checked={formData.hasValidFrom}
              onChange={onChange}
              disabled={loading}
              className={styles.checkbox}
            />
            {t('set_valid_from_date', 'Set Valid From Date')}
          </label>
          {formData.hasValidFrom && (
            <input
              type="datetime-local"
              name="validFrom"
              value={formData.validFrom}
              onChange={onChange}
              disabled={loading}
              className={styles.input}
            />
          )}
        </div>

        <div className={styles.formGroup}>
          <label>
            <input
              type="checkbox"
              name="hasValidUntil"
              checked={formData.hasValidUntil}
              onChange={onChange}
              disabled={loading}
              className={styles.checkbox}
            />
            {t('set_valid_until_date', 'Set Valid Until Date')}
          </label>
          {formData.hasValidUntil && (
            <input
              type="datetime-local"
              name="validUntil"
              value={formData.validUntil}
              onChange={onChange}
              disabled={loading}
              className={styles.input}
            />
          )}
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label>
            <input
              type="checkbox"
              name="hasMaxUsageCount"
              checked={formData.hasMaxUsageCount}
              onChange={onChange}
              disabled={loading}
              className={styles.checkbox}
            />
            {t('limit_usage_count', 'Limit Usage Count')}
          </label>
          {formData.hasMaxUsageCount && (
            <input
              type="text"
              inputMode="numeric"
              name="maxUsageCount"
              value={formData.maxUsageCount}
              onChange={onChange}
              disabled={loading}
              className={styles.input}
              placeholder="10"
            />
          )}
          <small className={styles.help}>
            {t('max_usage_count_help', 'Maximum number of times this discount can be used')}
          </small>
        </div>

        <div className={styles.formGroup}>
          <label>
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={onChange}
              disabled={loading}
              className={styles.checkbox}
            />
            {t('active', 'Active')}
          </label>
          <small className={styles.help}>
            {t('active_discounts_help', 'Only active discounts can be applied to orders')}
          </small>
        </div>
      </div>
    </>
  );
}
