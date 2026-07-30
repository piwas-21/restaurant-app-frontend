'use client';

// Set a new password from an emailed reset link. THIS is the route the backend has always
// linked to (`{FrontendBaseUrl}/reset-password?token=…&email=…`, EmailService.cs) and which
// did not exist — see the note in ../forgot-password/page.tsx.

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import { AuthCard, AuthSubmit, BackToLoginFooter } from '@/components/auth/PasswordResetShell';
import { useResetPasswordForm } from '@/hooks/auth/useResetPasswordForm';
import styles from '../PasswordReset.module.css';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <AuthCard>
          <p className={styles.outcomeBody}>{t('loading')}</p>
        </AuthCard>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

/** Shell for every terminal state, so the three of them cannot drift apart. */
function Outcome({
  ok,
  title,
  body,
  href,
  cta,
}: Readonly<{ ok: boolean; title: string; body: string; href: string; cta: string }>) {
  const Icon = ok ? CheckCircle : XCircle;
  return (
    <AuthCard>
      <div className={styles.outcome}>
        <Icon size={44} className={ok ? styles.outcomeIconOk : styles.outcomeIconBad} aria-hidden="true" />
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.outcomeBody}>{body}</p>
        <Link href={href} className={styles.link}>
          {cta}
        </Link>
      </div>
    </AuthCard>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';
  const { t, form, onSubmit, done, formError } = useResetPasswordForm(email, token);
  const { errors, isSubmitting } = form.formState;

  // A link with no token cannot be repaired by trying — say so instead of showing a form
  // that is guaranteed to fail after the user has picked a password.
  if (!email || !token) {
    return (
      <Outcome
        ok={false}
        title={t('reset_link_invalid_title')}
        body={t('reset_link_invalid_body')}
        href="/forgot-password"
        cta={t('reset_password_request_new')}
      />
    );
  }

  if (done) {
    return (
      <Outcome
        ok
        title={t('reset_password_success_title')}
        body={t('reset_password_success_body')}
        href="/auth/login"
        cta={t('go_to_login')}
      />
    );
  }

  return (
    <AuthCard>
      <h1 className={styles.title}>{t('reset_password_title')}</h1>
      <p className={styles.subtitle}>{t('reset_password_subtitle')}</p>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {/* role="alert": appears asynchronously after submit. Field errors get theirs
            from FormField. */}
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        <FormField label={t('new_password_label')} error={errors.newPassword?.message}>
          <input
            type="password"
            autoComplete="new-password"
            className={styles.input}
            placeholder={t('new_password_placeholder')}
            {...form.register('newPassword')}
          />
        </FormField>

        <FormField label={t('confirm_new_password_label')} error={errors.confirmPassword?.message}>
          <input
            type="password"
            autoComplete="new-password"
            className={styles.input}
            placeholder={t('confirm_password_placeholder')}
            {...form.register('confirmPassword')}
          />
        </FormField>

        <AuthSubmit pending={isSubmitting} label={t('reset_password_submit')} />
      </form>

      <BackToLoginFooter />
    </AuthCard>
  );
}
