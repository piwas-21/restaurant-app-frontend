'use client';

// craft RegisterPage (ADR-006 — Prompt 8). Craft chrome — a split "welcome
// card" (food-photo panel, masking-tape label, Amatic heading, Caveat subhead)
// — around the shared `RegisterFields` body, with the shared `RegisterSuccessCard`
// for the verify-email success state. Same behaviour as classic (shared
// `useRegisterForm` hook). Reuses every existing auth i18n key + the craft tape /
// subhead flavour keys.
import React from 'react';
import styles from './AuthPage.module.css';
import successStyles from './RegisterSuccess.module.css';
import socialStyles from './SocialLoginButtons.module.css';
import RegisterFields from '@/components/auth/RegisterFields';
import RegisterSuccessCard from '@/components/auth/RegisterSuccessCard';
import { useRegisterForm } from '@/hooks/auth/useRegisterForm';
import { BRANDING_HERO } from '@/lib/config';

export default function RegisterPage() {
  const form = useRegisterForm();
  const { t } = form;

  if (form.registrationSuccess) {
    return <RegisterSuccessCard styles={successStyles} form={form} />;
  }

  return (
    <main className={styles.authContainer}>
      <div className={styles.card}>
        <div className={styles.photo} style={{ backgroundImage: `url(${BRANDING_HERO})` }} aria-hidden="true" />
        <form className={styles.formSide} onSubmit={form.handleSubmit} noValidate>
          <span className={styles.tape}>{t('craft_auth_register_tape', 'Join us')}</span>
          <h1 className={styles.heading}>{t('register_page_title', 'Register')}</h1>
          <p className={styles.subhead}>
            {t('craft_auth_register_subhead', "Pull up a chair — let's get you set up.")}
          </p>
          <RegisterFields styles={styles} socialStyles={socialStyles} form={form} />
        </form>
      </div>
    </main>
  );
}
