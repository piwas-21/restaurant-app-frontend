'use client';

import Link from 'next/link';
import type { useRegisterForm } from '@/hooks/auth/useRegisterForm';
import AuthField from './AuthField';
import SocialLoginButtons from './SocialLoginButtons';

interface RegisterFieldsProps {
  /** The template's auth CSS module. */
  styles: Readonly<Record<string, string>>;
  /** Optional social-chrome module override (craft); classic uses the default. */
  socialStyles?: Readonly<Record<string, string>>;
  form: ReturnType<typeof useRegisterForm>;
}

/**
 * The register form's inner content — a general-error note, the five fields,
 * submit, the login switch link, and social sign-in. Shared by the classic and
 * craft `RegisterPage`s (which supply the surrounding `<form>` + heading +
 * chrome), so the two differ only in CSS.
 */
export default function RegisterFields({ styles, socialStyles, form }: Readonly<RegisterFieldsProps>) {
  const { t, formData, errors, handleChange } = form;
  return (
    <>
      {form.generalError && <p className={styles.errorMessage}>{form.generalError}</p>}
      <AuthField
        styles={styles}
        id="firstName"
        label={t('first_name', 'First Name')}
        type="text"
        value={formData.firstName}
        onChange={handleChange}
        inputRef={form.firstNameInputRef}
        withErrorSlot
        error={errors.firstName}
      />
      <AuthField
        styles={styles}
        id="lastName"
        label={t('last_name', 'Last Name')}
        type="text"
        value={formData.lastName}
        onChange={handleChange}
        withErrorSlot
        error={errors.lastName}
      />
      <AuthField
        styles={styles}
        id="email"
        label={t('email', 'Email')}
        type="email"
        value={formData.email}
        onChange={handleChange}
        withErrorSlot
        error={errors.email}
      />
      <AuthField
        styles={styles}
        id="password"
        label={t('password_label', 'Password')}
        type="password"
        value={formData.password}
        onChange={handleChange}
        withErrorSlot
        error={errors.password}
      />
      <AuthField
        styles={styles}
        id="confirmPassword"
        label={t('confirm_password_label', 'Confirm Password')}
        type="password"
        value={formData.confirmPassword}
        onChange={handleChange}
        withErrorSlot
        error={errors.confirmPassword}
      />
      <button type="submit" className={styles.submitButton}>
        {t('register_button', 'Register')}
      </button>
      <p className={styles.switchFormText}>
        {t('already_have_account', 'Already have an account?')}{' '}
        <Link href="/auth/login">{t('login_button', 'Login')}</Link>
      </p>
      <SocialLoginButtons styles={socialStyles} />
    </>
  );
}
