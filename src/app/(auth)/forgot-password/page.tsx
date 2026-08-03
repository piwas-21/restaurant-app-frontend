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
import { serverMessages } from '@/utils/apiFormErrors';
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
      // Branch on `success` ONLY, never on anything that could distinguish the two
      // existence cases. The endpoint is anti-enumeration by design and returns 200 with a
      // byte-identical body whether or not the address has an account — so `success:false`
      // can only mean the SERVER broke (the mail send is awaited inline and unguarded, so a
      // Resend outage surfaces as a **502**: `EmailDeliveryException` is mapped to BadGateway
      // by `ExceptionHandlingMiddleware`, not to a 500). Reporting that is not a leak, and
      // swallowing it told the user to wait for an email nobody sent.
      //
      // And the server's sentence on that path is worth printing rather than replacing. Verified
      // against the backend: `ForgotPasswordCommandHandler` returns the SAME success body for a
      // known and an unknown address, so nothing that reaches here is existence-dependent. What
      // does reach here is authored for the user to read:
      //   - the rate limiter — `[EnableRateLimiting("forgot-password")]`, whose rejection body is
      //     `{"success":false,"message":"Too many requests. Please slow down and try again
      //     shortly."}` (Program.cs `OnRejected`). Someone who pressed the button twice was told
      //     "An unexpected error occurred" and had no way to know that waiting was the fix;
      //   - the 502 above, whose body says "The email could not be delivered. Please try again
      //     later." — which is the difference between retrying and giving up.
      if (res?.success === false) {
        setFormError(serverMessages(res)[0] ?? t('unexpected_error'));
        return;
      }
      setSent(true);
    } catch {
      // IGNORED ON PURPOSE — nothing here carries a message worth showing. `forgotPassword` is a
      // raw `fetch` that returns `response.json()` for EVERY status, so a refusal never throws:
      // it arrives on the resolved path above. The only two ways to land here are a dead network
      // (`TypeError`) and a body that is not JSON (`SyntaxError`, which is how an empty 502 from
      // Caddy shows up), and both texts are client-authored — exactly the strings #401 removed
      // from users' screens. So the generic sentence IS the whole of what we can honestly say.
      setFormError(t('unexpected_error'));
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
