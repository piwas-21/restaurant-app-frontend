'use client';

// classic RegisterPage (ADR-006 — auth surface). The original RUMI register
// markup, relocated verbatim from src/app/auth/register/page.tsx behind the
// `@active-template/RegisterPage` re-export. Rendered DOM is unchanged; the
// former inline logic now lives in the shared `useRegisterForm` hook.
import React from 'react';
import Link from 'next/link';
import { Mail, CheckCircle, ArrowRight } from 'lucide-react';
import styles from '@/AuthPage.module.css';
import successStyles from './RegisterSuccess.module.css';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';
import { useRegisterForm } from '@/hooks/auth/useRegisterForm';

export default function RegisterPage() {
  const {
    t,
    formData,
    errors,
    generalError,
    registrationSuccess,
    resendLoading,
    resendMessage,
    firstNameInputRef,
    handleChange,
    handleSubmit,
    handleResendEmail,
  } = useRegisterForm();

  if (registrationSuccess) {
    return (
      <div className={successStyles.successContainer}>
        <div className={successStyles.successCard}>
          <div className={successStyles.successContent}>
            <div className={successStyles.emailIconWrapper}>
              <Mail size={60} />
              <div className={successStyles.checkmark}>
                <CheckCircle size={24} />
              </div>
            </div>

            <h1 className={successStyles.successTitle}>{t('registration_successful', 'Registration Successful!')}</h1>

            <div className={successStyles.instructionsBox}>
              <p className={successStyles.instructionsText}>
                {t('verify_email_instructions', 'We have sent a verification email to')}
              </p>
              <div className={successStyles.emailHighlight}>{formData.email}</div>

              <ul className={successStyles.stepsList}>
                <li>
                  <span className={successStyles.stepNumber}>1</span>
                  <span>{t('check_inbox', 'Check your inbox (and spam folder)')}</span>
                </li>
                <li>
                  <span className={successStyles.stepNumber}>2</span>
                  <span>{t('click_verification_link', 'Click the verification link in the email')}</span>
                </li>
                <li>
                  <span className={successStyles.stepNumber}>3</span>
                  <span>{t('complete_verification', 'Complete the verification to activate your account')}</span>
                </li>
              </ul>
            </div>

            {resendMessage && (
              <div className={successStyles.resendMessage}>
                <CheckCircle size={18} />
                <span>{resendMessage}</span>
              </div>
            )}

            <div className={successStyles.buttonGroup}>
              <Link href="/auth/login" className={successStyles.loginButton}>
                {t('go_to_login', 'Go to Login')}
                <ArrowRight size={18} />
              </Link>
              <button onClick={handleResendEmail} disabled={resendLoading} className={successStyles.resendButton}>
                <Mail size={18} />
                {resendLoading ? t('sending', 'Sending...') : t('resend_email', 'Resend Email')}
              </button>
            </div>

            <p className={successStyles.helpText}>
              {t('didnt_receive_email', "Didn't receive the email?")}{' '}
              {t('check_spam_or_contact', 'Please check your spam folder.')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authContainer}>
      <form className={styles.authForm} onSubmit={handleSubmit}>
        <h1>{t('register_page_title', 'Register')}</h1>
        {generalError && <p className={styles.errorMessage}>{generalError}</p>}
        <div className={styles.formGroup}>
          <label htmlFor="firstName">{t('first_name', 'First Name')}</label>
          <input
            type="text"
            id="firstName"
            ref={firstNameInputRef}
            value={formData.firstName}
            onChange={handleChange}
            required
            className={errors.firstName ? styles.inputError : ''}
          />
          {errors.firstName && <p className={styles.fieldError}>{errors.firstName}</p>}
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="lastName">{t('last_name', 'Last Name')}</label>
          <input
            type="text"
            id="lastName"
            value={formData.lastName}
            onChange={handleChange}
            required
            className={errors.lastName ? styles.inputError : ''}
          />
          {errors.lastName && <p className={styles.fieldError}>{errors.lastName}</p>}
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="email">{t('email', 'Email')}</label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={handleChange}
            required
            className={errors.email ? styles.inputError : ''}
          />
          {errors.email && <p className={styles.fieldError}>{errors.email}</p>}
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="password">{t('password_label', 'Password')}</label>
          <input
            type="password"
            id="password"
            value={formData.password}
            onChange={handleChange}
            required
            className={errors.password ? styles.inputError : ''}
          />
          {errors.password && <p className={styles.fieldError}>{errors.password}</p>}
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="confirmPassword">{t('confirm_password_label', 'Confirm Password')}</label>
          <input
            type="password"
            id="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            className={errors.confirmPassword ? styles.inputError : ''}
          />
          {errors.confirmPassword && <p className={styles.fieldError}>{errors.confirmPassword}</p>}
        </div>
        <button type="submit" className={styles.submitButton}>
          {t('register_button', 'Register')}
        </button>
        <p className={styles.switchFormText}>
          {t('already_have_account', 'Already have an account?')}{' '}
          <Link href="/auth/login">{t('login_button', 'Login')}</Link>
        </p>
        <SocialLoginButtons />
      </form>
    </div>
  );
}
