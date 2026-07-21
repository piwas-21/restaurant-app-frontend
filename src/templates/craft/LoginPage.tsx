'use client';

// craft LoginPage (ADR-006 — Prompt 8). Craft chrome — a split "welcome card"
// (food-photo panel, masking-tape label, Amatic heading, Caveat subhead) —
// around the shared `LoginForm` body. Same login behaviour as classic (shared
// `useLoginForm` hook). Reuses every existing auth i18n key + the craft tape /
// subhead flavour keys.
import React from 'react';
import styles from './AuthPage.module.css';
import socialStyles from './SocialLoginButtons.module.css';
import LoginForm from '@/components/auth/LoginForm';
import { useLoginForm } from '@/hooks/auth/useLoginForm';
import { BRANDING_HERO } from '@/lib/config';

export default function LoginPage() {
  const form = useLoginForm();
  const { t } = form;
  return (
    <main className={styles.authContainer}>
      <div className={styles.card}>
        <div className={styles.photo} style={{ backgroundImage: `url(${BRANDING_HERO})` }} aria-hidden="true" />
        <div className={styles.formSide}>
          <span className={styles.tape}>{t('craft_auth_login_tape', 'Welcome back')}</span>
          <h1 id="login-heading" className={styles.heading}>
            {t('login_page_title', 'Login')}
          </h1>
          <p className={styles.subhead}>{t('craft_auth_login_subhead', "Gather 'round the table once more.")}</p>
          <LoginForm styles={styles} socialStyles={socialStyles} form={form} />
        </div>
      </div>
    </main>
  );
}
