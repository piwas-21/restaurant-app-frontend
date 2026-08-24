'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './PasswordManagementSection.module.css';

interface PasswordManagementSectionProps {
  /**
   * Does this account HAVE a password? False turns the section into a set-a-password form: no
   * current-password field (there is nothing to prove), and a heading and button that say so.
   *
   * A Google/Apple sign-up has no password, so the change form could never succeed for it — see
   * `useAccountPassword`, which also explains why an unanswered probe renders `true`.
   */
  hasExistingPassword: boolean;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  passwordErrors: Partial<Record<string, string>>;
  passwordSuccess: string;
  passwordStrength: number;
  passwordStrengthText: string;
  handleCurrentPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleNewPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleConfirmNewPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePasswordChangeSubmit: (e: React.FormEvent) => Promise<void>;
  getStrengthBarStyle: (level: number) => string;
}

export default function PasswordManagementSection({
  hasExistingPassword,
  currentPassword,
  newPassword,
  confirmNewPassword,
  passwordErrors,
  passwordSuccess,
  passwordStrengthText,
  handleCurrentPasswordChange,
  handleNewPasswordChange,
  handleConfirmNewPasswordChange,
  handlePasswordChangeSubmit,
  getStrengthBarStyle,
}: PasswordManagementSectionProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {hasExistingPassword
          ? t('password_management_title', 'Password Management')
          : t('set_password_title', 'Set a Password')}
      </h2>
      {!hasExistingPassword && (
        <p className={styles.sectionHint}>
          {t(
            'set_password_hint',
            'You signed in with Google or Apple, so your account has no password yet. Set one to also sign in with your email address.',
          )}
        </p>
      )}
      {passwordSuccess && <p className={styles.successMessage}>{passwordSuccess}</p>}
      {passwordErrors.form && <p className={styles.errorMessage}>{passwordErrors.form}</p>}
      <form onSubmit={handlePasswordChangeSubmit} noValidate>
        {hasExistingPassword && (
          <div className={styles.formGroup}>
            <label htmlFor="currentPassword">{t('current_password_label', 'Current Password')}</label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={currentPassword}
              onChange={handleCurrentPasswordChange}
              className={styles.formInput}
            />
            {passwordErrors.currentPassword && <p className={styles.errorMessage}>{passwordErrors.currentPassword}</p>}
          </div>
        )}

        <div className={styles.formGroup}>
          <label htmlFor="newPassword">{t('new_password_label', 'New Password')}</label>
          <input
            type="password"
            id="newPassword"
            name="newPassword"
            value={newPassword}
            onChange={handleNewPasswordChange}
            className={styles.formInput}
          />
          {newPassword && (
            <div className={styles.passwordStrengthContainer}>
              <span style={{ marginInlineEnd: '0.5rem' }}>{t('password_strength_label', 'Password Strength:')}</span>
              {[1, 2, 3, 4, 5].map((level) => (
                <div key={level} className={`${styles.strengthBar} ${getStrengthBarStyle(level)}`} />
              ))}
              <span style={{ marginInlineStart: '0.5rem' }}>{passwordStrengthText}</span>
            </div>
          )}
          {passwordErrors.newPassword && <p className={styles.errorMessage}>{passwordErrors.newPassword}</p>}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="confirmNewPassword">{t('confirm_new_password_label', 'Confirm New Password')}</label>
          <input
            type="password"
            id="confirmNewPassword"
            name="confirmNewPassword"
            value={confirmNewPassword}
            onChange={handleConfirmNewPasswordChange}
            className={styles.formInput}
          />
          {passwordErrors.confirmNewPassword && (
            <p className={styles.errorMessage}>{passwordErrors.confirmNewPassword}</p>
          )}
        </div>
        <div className={styles.formActions}>
          <button type="submit" className={styles.changePasswordButton}>
            {hasExistingPassword
              ? t('change_password_button', 'Change Password')
              : t('set_password_button', 'Set Password')}
          </button>
        </div>
      </form>
    </section>
  );
}
