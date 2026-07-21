'use client';

// classic RegisterPage (ADR-006 — auth surface). The original RUMI register
// chrome, relocated from src/app/auth/register/page.tsx behind the
// `@active-template/RegisterPage` re-export. The form body is the shared
// `RegisterFields` and the success screen the shared `RegisterSuccessCard`
// (both also used by craft); this file supplies only the classic card +
// heading. Rendered DOM is unchanged.
import React from 'react';
import styles from '@/AuthPage.module.css';
import successStyles from './RegisterSuccess.module.css';
import RegisterFields from '@/components/auth/RegisterFields';
import RegisterSuccessCard from '@/components/auth/RegisterSuccessCard';
import { useRegisterForm } from '@/hooks/auth/useRegisterForm';

export default function RegisterPage() {
  const form = useRegisterForm();

  if (form.registrationSuccess) {
    return <RegisterSuccessCard styles={successStyles} form={form} />;
  }

  return (
    <div className={styles.authContainer}>
      <form className={styles.authForm} onSubmit={form.handleSubmit}>
        <h1>{form.t('register_page_title', 'Register')}</h1>
        <RegisterFields styles={styles} form={form} />
      </form>
    </div>
  );
}
