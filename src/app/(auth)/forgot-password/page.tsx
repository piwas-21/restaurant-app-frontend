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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { MailCheck } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import { AuthCard, AuthSubmit, BackToLoginFooter } from '@/components/auth/PasswordResetShell';
import { forgotPassword } from '@/services/authService';
import { serverMessage } from '@/utils/apiFormErrors';
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
      const res = await forgotPassword({ email: values.email });
      // A GUARD, not a live path — and the difference is worth stating, because this comment used
      // to claim the opposite. Both failures it named (the rate limiter's 429, the mail 502) are
      // real, but neither is a 200: since #414 routed this through `apiClient` they THROW, and are
      // handled in the catch below. And no 200 can carry `success:false` here at all —
      // `ForgotPasswordCommandHandler` has no `Failure` return; every arm is `SuccessWithData`.
      //
      // Kept anyway, because the envelope is the contract and reporting a `success:false` as "check
      // your inbox" is the one outcome that must not happen — the user would wait for an email
      // nobody sent. If a `Failure` arm is ever added, this reports it instead of silently
      // succeeding.
      //
      // Branch on `success` ONLY, never on anything that could distinguish the two existence cases:
      // the endpoint is anti-enumeration by design and answers a known and an unknown address with
      // a byte-identical body, so nothing reaching here is existence-dependent.
      if (res?.success === false) {
        setFormError(serverMessage(res) ?? t('unexpected_error'));
        return;
      }
      setSent(true);
    } catch (error) {
      // #414: `forgotPassword` goes through `apiClient` now, so the two failures named above no
      // longer depend on the endpoint choosing to answer 200. The rate limiter's 429 ("Too many
      // requests. Please slow down and try again shortly.") and the 502's "The email could not be
      // delivered. Please try again later." arrive HERE as an `ApiError`, and both are worth
      // printing — someone who pressed the button twice used to be told "An unexpected error
      // occurred" with no way to know that waiting was the fix.
      //
      // Still nothing existence-dependent: the endpoint is anti-enumeration by design and answers
      // a known and an unknown address identically, so no reachable message here can distinguish
      // them. A dead network (`TypeError`) or a non-JSON body (`SyntaxError`) yields no
      // server-authored text, and those strings are client-authored — #401 removed them from
      // users' screens — so the translated sentence stays as the fallback.
      setFormError(serverMessage(error) ?? t('unexpected_error'));
    }
  };

  if (sent) {
    return (
      <AuthCard>
        <div className={styles.outcome}>
          <MailCheck size={44} className={styles.outcomeIconOk} aria-hidden="true" />
          <h1 className={styles.title}>{t('forgot_password_sent_title')}</h1>
          <p className={styles.outcomeBody}>{t('forgot_password_sent_body')}</p>
        </div>
        <BackToLoginFooter />
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1 className={styles.title}>{t('forgot_password_title')}</h1>
      <p className={styles.subtitle}>{t('forgot_password_subtitle')}</p>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* role="alert": this appears asynchronously after submit, so without it a
            screen-reader user only notices the button leaving its pending state. Field
            errors get theirs from FormField. */}
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        <FormField label={t('email')} error={errors.email?.message}>
          <input
            type="email"
            autoComplete="email"
            className={styles.input}
            placeholder={t('email')}
            {...register('email')}
          />
        </FormField>

        <AuthSubmit pending={isSubmitting} label={t('forgot_password_submit')} />
      </form>

      <BackToLoginFooter />
    </AuthCard>
  );
}
