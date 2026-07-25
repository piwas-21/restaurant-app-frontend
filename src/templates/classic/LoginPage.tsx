'use client';

// classic LoginPage (ADR-006 — auth surface). The original RUMI login chrome,
// relocated from src/app/auth/login/page.tsx behind the
// `@active-template/LoginPage` re-export. The form body is the shared
// `LoginForm` (also used by craft); this file supplies only the classic card +
// heading. Rendered DOM is visually unchanged (the redundant `role="form"` on
// the wrapper div moved to a proper `aria-labelledby` on the real `<form>`).
import React from 'react';
import styles from '@/AuthPage.module.css';
import LoginForm from '@/components/auth/LoginForm';
import { useLoginForm } from '@/hooks/auth/useLoginForm';

export default function LoginPage() {
  const form = useLoginForm();
  return (
    <main className={styles.authContainer}>
      <div className={styles.authForm}>
        <h1 id="login-heading">{form.t('login_page_title', 'Login')}</h1>
        <LoginForm styles={styles} form={form} />
      </div>
    </main>
  );
}
