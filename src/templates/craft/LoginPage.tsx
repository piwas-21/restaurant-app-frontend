'use client';

// craft LoginPage (ADR-006 — Prompt 8). Same login behaviour as classic (via
// the shared `useLoginForm` hook) composed as a craft "welcome card": a split
// letterpress plate with a food-photo panel, a masking-tape label, an Amatic
// heading, craft-paper underline inputs, a terracotta letterpress pill, and a
// dotted-divider social row. Reuses every existing auth i18n key; adds only the
// craft tape/subhead flavour keys.
import React from 'react';
import Link from 'next/link';
import styles from './AuthPage.module.css';
import socialStyles from './SocialLoginButtons.module.css';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';
import VerificationResendNotice from '@/components/auth/VerificationResendNotice';
import { useLoginForm } from '@/hooks/auth/useLoginForm';
import { BRANDING_HERO } from '@/lib/config';

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
      <div className={styles.card}>
        <div className={styles.photo} style={{ backgroundImage: `url(${BRANDING_HERO})` }} aria-hidden="true" />
        <div className={styles.formSide} role="form" aria-labelledby="login-heading">
          <span className={styles.tape}>{t('craft_auth_login_tape', 'Welcome back')}</span>
          <h1 id="login-heading" className={styles.heading}>
            {t('login_page_title', 'Login')}
          </h1>
          <p className={styles.subhead}>{t('craft_auth_login_subhead', "Gather 'round the table once more.")}</p>
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
          <SocialLoginButtons styles={socialStyles} />
        </div>
      </div>
    </main>
  );
}
