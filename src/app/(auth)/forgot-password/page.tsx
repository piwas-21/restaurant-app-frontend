'use client';

// Request a password-reset link.
//
// This page and /reset-password close a loop that was BROKEN END TO END: the backend's
// ForgotPasswordCommand already mints a real ASP.NET Identity token and emails a link to
// `{FrontendBaseUrl}/reset-password?token=…&email=…` (EmailService.cs), and that route did
// not exist — verified against production, `www.rumirestaurant.ch/reset-password` → 404.
// So no tenant admin, RUMI's included, could reset their own password, and
// `authService.forgotPassword/resetPassword` were dead code.
//
// It also unblocks SOFRA-ONBOARDING-PLAN O3's credential bullet: with a working reset, a
// new tenant owner sets their own password and the generated bootstrap password never has
// to leave the box.

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MailCheck } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import { forgotPassword } from '@/services/authService';
import styles from '../PasswordReset.module.css';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');

  const schema = z.object({
    email: z.string().min(1, t('email_required')).email(t('email_required')),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    setFormError('');
    try {
      await forgotPassword({ email: values.email });
      // Deliberately unconditional. The endpoint is anti-enumeration by design — it
      // answers "if the email exists…" whether or not it does — so branching on the
      // response would leak exactly what the backend refuses to.
      setSent(true);
    } catch {
      setFormError(t('unexpected_error'));
    }
  };

  if (sent) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.outcome}>
            <MailCheck size={44} className={styles.outcomeIconOk} aria-hidden="true" />
            <h1 className={styles.title}>{t('forgot_password_sent_title')}</h1>
            <p className={styles.outcomeBody}>{t('forgot_password_sent_body')}</p>
            <Link href="/auth/login" className={styles.link}>
              <ArrowLeft size={16} aria-hidden="true" />
              {t('back_to_login')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('forgot_password_title')}</h1>
        <p className={styles.subtitle}>{t('forgot_password_subtitle')}</p>

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          {formError && <p className={styles.formError}>{formError}</p>}

          <FormField label={t('email')} error={errors.email?.message}>
            <input
              type="email"
              autoComplete="email"
              className={styles.input}
              placeholder={t('email')}
              {...register('email')}
            />
          </FormField>

          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? t('sending') : t('forgot_password_submit')}
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
