'use client';

// classic LoginPage (ADR-006 — auth surface). The original RUMI login markup,
// relocated verbatim from src/app/auth/login/page.tsx behind the
// `@active-template/LoginPage` re-export so the craft template can ship its own
// version. Rendered DOM is unchanged; the former inline logic now lives in the
// shared `useLoginForm` hook (consumed by both templates) and the former
// inline-styled resend button is the shared `VerificationResendNotice`.
import React from 'react';
import Link from 'next/link';
import styles from '@/AuthPage.module.css';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';
import VerificationResendNotice from '@/components/auth/VerificationResendNotice';
import { useLoginForm } from '@/hooks/auth/useLoginForm';

export default function LoginPage() {
  const {
    t,
    email,
    setEmail,
    password,
    setPassword,
    error,
    needsVerification,
    resendLoading,
    resendMessage,
    resendSucceeded,
    emailInputRef,
    handleSubmit,
    handleResendVerification,
  } = useLoginForm();

  return (
    <main className={styles.authContainer}>
      <div className={styles.authForm} role="form" aria-labelledby="login-heading">
        <h1 id="login-heading">{t('login_page_title', 'Login')}</h1>
        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className={styles.errorMessage} role="alert">
              <p>{error}</p>
              {needsVerification && (
                <VerificationResendNotice
                  resendLoading={resendLoading}
                  resendMessage={resendMessage}
                  resendSucceeded={resendSucceeded}
                  onResend={handleResendVerification}
                  styles={styles}
                />
              )}
            </div>
          )}
          <div className={styles.formGroup}>
            <label htmlFor="email">{t('email', 'Email')}</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
              ref={emailInputRef}
              autoComplete="email"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password">{t('password_label', 'Password')}</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className={styles.submitButton}>
            {t('login_button', 'Login')}
          </button>
        </form>
        <p className={styles.switchFormText}>
          {t('dont_have_account_auth', "Don't have an account?")}{' '}
          <Link href="/auth/register">{t('register_here', 'Register here')}</Link>
        </p>
        <SocialLoginButtons />
      </div>
    </main>
  );
}
