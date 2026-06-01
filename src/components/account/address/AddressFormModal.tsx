'use client';

import { useTranslation } from 'react-i18next';
import type { AddressDto, CreateAddressCommand, UpdateAddressCommand } from '@/services/addressService';
import { useAddressForm } from '@/hooks/account/useAddressForm';
import styles from '../AddressManagement.module.css';

interface AddressFormModalProps {
  address: AddressDto | null;
  onSave: (data: CreateAddressCommand | UpdateAddressCommand) => Promise<void>;
  onCancel: () => void;
}

/**
 * The add/edit-address modal form. Form state/validation/submit live in useAddressForm. Extracted
 * verbatim from AddressManagement.tsx (Sprint 4/6 god-file decomposition).
 */
export default function AddressFormModal({ address, onSave, onCancel }: AddressFormModalProps) {
  const { t } = useTranslation();
  const { formData, errors, saving, handleSubmit, handleChange } = useAddressForm(address, onSave);

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>{address ? t('edit_address_title', 'Edit Address') : t('add_address_title', 'Add New Address')}</h2>

        <form onSubmit={handleSubmit} className={styles.addressForm}>
          {errors.form && <div className={styles.formError}>{errors.form}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="label">{t('address_label', 'Label')} *</label>
            <input
              type="text"
              id="label"
              name="label"
              value={formData.label}
              onChange={handleChange}
              placeholder={t('address_label_placeholder', 'e.g., Home, Work, Office')}
              className={errors.label ? styles.inputError : ''}
            />
            {errors.label && <span className={styles.errorText}>{errors.label}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="addressLine1">{t('address_line1', 'Address Line 1')} *</label>
            <input
              type="text"
              id="addressLine1"
              name="addressLine1"
              value={formData.addressLine1}
              onChange={handleChange}
              placeholder={t('address_line1_placeholder', 'Street address')}
              className={errors.addressLine1 ? styles.inputError : ''}
            />
            {errors.addressLine1 && <span className={styles.errorText}>{errors.addressLine1}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="addressLine2">{t('address_line2', 'Address Line 2')}</label>
            <input
              type="text"
              id="addressLine2"
              name="addressLine2"
              value={formData.addressLine2}
              onChange={handleChange}
              placeholder={t('address_line2_placeholder', 'Apartment, suite, etc. (optional)')}
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="city">{t('city', 'City')} *</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className={errors.city ? styles.inputError : ''}
              />
              {errors.city && <span className={styles.errorText}>{errors.city}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="postalCode">{t('postal_code', 'Postal Code')} *</label>
              <input
                type="text"
                id="postalCode"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                className={errors.postalCode ? styles.inputError : ''}
              />
              {errors.postalCode && <span className={styles.errorText}>{errors.postalCode}</span>}
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="state">{t('state', 'State/Canton')}</label>
              <input type="text" id="state" name="state" value={formData.state} onChange={handleChange} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="country">{t('country', 'Country')} *</label>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className={errors.country ? styles.inputError : ''}
              />
              {errors.country && <span className={styles.errorText}>{errors.country}</span>}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="phone">{t('phone', 'Phone Number')}</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+41 79 123 45 67"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="deliveryInstructions">{t('delivery_instructions', 'Delivery Instructions')}</label>
            <textarea
              id="deliveryInstructions"
              name="deliveryInstructions"
              value={formData.deliveryInstructions}
              onChange={handleChange}
              placeholder={t('delivery_instructions_placeholder', 'e.g., Ring the bell, Leave at door')}
              rows={3}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={onCancel} className={styles.cancelButton} disabled={saving}>
              {t('cancel_button', 'Cancel')}
            </button>
            <button type="submit" className={styles.saveButton} disabled={saving}>
              {saving ? t('saving', 'Saving...') : t('save_button', 'Save Address')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
