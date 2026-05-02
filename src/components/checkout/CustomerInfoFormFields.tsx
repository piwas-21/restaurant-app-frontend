'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { User, Mail, Phone, ChevronRight, AlertCircle } from 'lucide-react';
import type { CustomerInfoFormState } from '@/hooks/checkout/useCustomerInfoForm';
import styles from '../../app/styles/CustomerInfoPage.module.css';

interface Props {
  form: CustomerInfoFormState;
}

/**
 * The editable customer-info form: 3 inputs (name/email/phone), the
 * save-info checkbox for anonymous users, and the back/continue actions.
 * Pure JSX — every piece of state and every handler comes from
 * `useCustomerInfoForm` via the `form` prop.
 */
export default function CustomerInfoFormFields({ form }: Props) {
  const { t } = useTranslation();

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        form.handleContinue();
      }}
    >
      <div className={styles.inputGroup}>
        <label htmlFor="name" className={styles.label}>
          <User size={20} />
          {t('full_name', 'Full Name')}
          <span className={styles.required}>*</span>
        </label>
        <input
          type="text"
          id="name"
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          onBlur={form.handleNameBlur}
          placeholder={t('enter_full_name', 'Enter your full name')}
          className={`${styles.input} ${form.nameError ? styles.inputError : ''}`}
          autoComplete="name"
        />
        {form.nameError && (
          <p className={styles.error}>
            <AlertCircle size={16} />
            {form.nameError}
          </p>
        )}
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="email" className={styles.label}>
          <Mail size={20} />
          {t('email_address', 'Email Address')}
          <span className={styles.required}>*</span>
        </label>
        <input
          type="email"
          id="email"
          value={form.email}
          onChange={(e) => form.setEmail(e.target.value)}
          onBlur={form.handleEmailBlur}
          placeholder={t('enter_email', 'Enter your email address')}
          className={`${styles.input} ${form.emailError ? styles.inputError : ''}`}
          autoComplete="email"
        />
        {form.emailError && (
          <p className={styles.error}>
            <AlertCircle size={16} />
            {form.emailError}
          </p>
        )}
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="phone" className={styles.label}>
          <Phone size={20} />
          {t('phone_number', 'Phone Number')}
          <span className={styles.optional}>{t('optional', '(Optional)')}</span>
        </label>
        <input
          type="tel"
          id="phone"
          value={form.phone}
          onChange={(e) => form.setPhone(e.target.value)}
          onBlur={form.handlePhoneBlur}
          placeholder={t('enter_phone', '+1 555 123 4567 or any phone number')}
          className={`${styles.input} ${form.phoneError ? styles.inputError : ''}`}
          autoComplete="tel"
        />
        {form.phoneError && (
          <p className={styles.error}>
            <AlertCircle size={16} />
            {form.phoneError}
          </p>
        )}
        <p className={styles.hint}>
          {t(
            'phone_hint_optional',
            'You can enter a phone number in any format (e.g., +1 555 123 4567 or 555-123-4567)',
          )}
        </p>
      </div>

      {!form.isLoggedIn && (
        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={form.saveInfo}
              onChange={(e) => form.setSaveInfo(e.target.checked)}
              className={styles.checkbox}
            />
            <span>{t('save_info_for_next_time', 'Save my information for next time')}</span>
          </label>
          <p className={styles.checkboxHint}>
            {t('save_info_hint', 'Your information will be stored locally on your device')}
          </p>
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" onClick={form.handleBack} className={styles.backButton}>
          {t('back', 'Back')}
        </button>
        <button type="submit" className={styles.continueButton}>
          {t('continue_to_review', 'Continue to Review')}
          <ChevronRight size={20} />
        </button>
      </div>
    </form>
  );
}
