'use client';

// The chrome shared by /forgot-password and /reset-password.
//
// Extracted because SonarCloud's new-code duplication gate caught the two pages sharing an
// 18-line block verbatim (submit button + back-to-login footer + closing markup) — but the
// duplication was worth removing on its own terms. These two pages are one flow, and the
// shared CSS module's header already argues the point: a reset page that drifts from the
// login page it came from is how a reset page starts looking like a phishing page. Sharing
// the chrome makes that drift impossible rather than merely unlikely.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import styles from '@/app/(auth)/PasswordReset.module.css';

/** Centred card. Used by both forms and by every terminal state. */
export function AuthCard({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>{children}</div>
    </div>
  );
}

/** Primary action. `pending` comes from react-hook-form's `isSubmitting`. */
export function AuthSubmit({ pending, label }: Readonly<{ pending: boolean; label: string }>) {
  const { t } = useTranslation();
  return (
    <button type="submit" className={styles.submit} disabled={pending}>
      {pending ? t('sending') : label}
    </button>
  );
}

/** The way back for someone who landed here by accident, or who remembered after all. */
export function BackToLoginFooter() {
  const { t } = useTranslation();
  return (
    <div className={styles.footer}>
      <Link href="/auth/login" className={styles.link}>
        <ArrowLeft size={16} aria-hidden="true" />
        {t('back_to_login')}
      </Link>
    </div>
  );
}
