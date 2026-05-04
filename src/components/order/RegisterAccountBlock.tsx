'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import { MIN_PASSWORD_LENGTH } from '@/schemas/customerInfo.schema';
import type { RegisterField, RegisterFieldsErrors, RegisterFieldsValue } from './GuestCustomerInfoFields';
import styles from './GuestCustomerInfoFields.module.css';

interface RegisterAccountBlockProps {
  fieldIdPrefix: string;
  wantsRegister: boolean;
  setWantsRegister: (next: boolean) => void;
  value: RegisterFieldsValue;
  errors: RegisterFieldsErrors;
  onChange: (field: RegisterField, next: string) => void;
  onBlur: (field: RegisterField) => void;
  disabled?: boolean;
}

/**
 * §C1.5.g register-account block: benefits list + opt-in checkbox +
 * password fields. Rendered by `GuestCustomerInfoFields` for guests
 * (and split out as a separate file purely to keep that component under
 * the §4 250-LOC ceiling).
 */
export default function RegisterAccountBlock({
  fieldIdPrefix,
  wantsRegister,
  setWantsRegister,
  value,
  errors,
  onChange,
  onBlur,
  disabled,
}: RegisterAccountBlockProps) {
  const { t } = useTranslation();
  const pwId = `${fieldIdPrefix}-password`;
  const pw2Id = `${fieldIdPrefix}-confirm-password`;
  const requiredMark = ' *';

  return (
    <div className={styles.registerBlock}>
      <h3 className={styles.registerHeading}>{t('dont_have_account', "Don't have an account yet?")}</h3>
      <p className={styles.registerSubtitle}>
        {t('register_benefits', 'Create a RUMI account to unlock exclusive benefits')}
      </p>
      <ul className={styles.benefits}>
        <li>
          <Star size={16} aria-hidden="true" />
          <span>{t('benefit_fidelity', 'Earn Fidelity Points on every order')}</span>
        </li>
        <li>
          <Star size={16} aria-hidden="true" />
          <span>{t('benefit_rewards', 'Redeem points for discounts')}</span>
        </li>
        <li>
          <Star size={16} aria-hidden="true" />
          <span>{t('benefit_tracking', 'Track your order history')}</span>
        </li>
        <li>
          <Star size={16} aria-hidden="true" />
          <span>{t('benefit_reservations', 'Manage your reservations easily')}</span>
        </li>
      </ul>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={wantsRegister}
          onChange={(e) => setWantsRegister(e.target.checked)}
          disabled={disabled}
        />
        <span>{t('create_account_with_details', 'Create my account with these details')}</span>
      </label>

      {wantsRegister && (
        <div className={styles.passwordFields}>
          <FormField label={`${t('password_label', 'Password')}${requiredMark}`} error={errors.password} htmlFor={pwId}>
            <input
              id={pwId}
              type="password"
              value={value.password}
              onChange={(e) => onChange('password', e.target.value)}
              onBlur={() => onBlur('password')}
              disabled={disabled}
              autoComplete="new-password"
              className={styles.input}
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </FormField>

          <FormField
            label={`${t('confirm_password', 'Confirm Password')}${requiredMark}`}
            error={errors.confirmPassword}
            htmlFor={pw2Id}
          >
            <input
              id={pw2Id}
              type="password"
              value={value.confirmPassword}
              onChange={(e) => onChange('confirmPassword', e.target.value)}
              onBlur={() => onBlur('confirmPassword')}
              disabled={disabled}
              autoComplete="new-password"
              className={styles.input}
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </FormField>
        </div>
      )}
    </div>
  );
}
