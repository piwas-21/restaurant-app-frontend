'use client';

// Set a new password from an emailed reset link. THIS is the route the backend has always
// linked to (`{FrontendBaseUrl}/reset-password?token=…&email=…`, EmailService.cs) and which
// did not exist — see the note in ../forgot-password/page.tsx.

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import { resetPassword } from '@/services/authService';
import styles from '../PasswordReset.module.css';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.card}>
            <p className={styles.outcomeBody}>{t('loading')}</p>
          </div>
        </div>
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
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.outcome}>
          <Icon size={44} className={ok ? styles.outcomeIconOk : styles.outcomeIconBad} aria-hidden="true" />
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.outcomeBody}>{body}</p>
          <Link href={href} className={styles.link}>
            {cta}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordForm() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState('');

  // Mirrors the backend exactly — Identity's policy in Program.cs and
  // ResetPasswordCommandValidator both require 8+ with upper, lower, digit and special.
  // Reusing the existing `password_security_rules_error` string keeps one message in all
  // ten locales instead of five new ones, and keeps it identical to what other surfaces say.
  const schema = z
    .object({
      newPassword: z
        .string()
        .min(8, t('password_security_rules_error'))
        .regex(/[A-Z]/, t('password_security_rules_error'))
        .regex(/[a-z]/, t('password_security_rules_error'))
        .regex(/[0-9]/, t('password_security_rules_error'))
        .regex(/[^a-zA-Z0-9]/, t('password_security_rules_error')),
      confirmPassword: z.string().min(1, t('passwords_do_not_match')),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      message: t('passwords_do_not_match'),
      path: ['confirmPassword'],
    });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

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

  const onSubmit = async (values: Values) => {
    setFormError('');
    try {
      const res = await resetPassword({
        email,
        token,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      if (res?.succeeded || res?.success) {
        setDone(true);
        return;
      }
      // Surface the server's own reason — an expired or already-used token is the common
      // case and the user needs to know to request a new link, not retype a password.
      setFormError(res?.messages?.[0] || res?.message || t('unexpected_error'));
    } catch {
      setFormError(t('unexpected_error'));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('reset_password_title')}</h1>
        <p className={styles.subtitle}>{t('reset_password_subtitle')}</p>

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          {formError && <p className={styles.formError}>{formError}</p>}

          <FormField label={t('new_password_label')} error={errors.newPassword?.message}>
            <input
              type="password"
              autoComplete="new-password"
              className={styles.input}
              placeholder={t('new_password_placeholder')}
              {...register('newPassword')}
            />
          </FormField>

          <FormField label={t('confirm_new_password_label')} error={errors.confirmPassword?.message}>
            <input
              type="password"
              autoComplete="new-password"
              className={styles.input}
              placeholder={t('confirm_password_placeholder')}
              {...register('confirmPassword')}
            />
          </FormField>

          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? t('sending') : t('reset_password_submit')}
          </button>
        </form>

        <div className={styles.footer}>
          <Link href="/auth/login" className={styles.link}>
            <ArrowLeft size={16} aria-hidden="true" />
            {t('back_to_login')}
          </Link>
        </div>
      </div>
    </div>
  );
}
