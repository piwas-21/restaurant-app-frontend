'use client';

import Link from 'next/link';
import type { useLoginForm } from '@/hooks/auth/useLoginForm';
import AuthField from './AuthField';
import SocialLoginButtons from './SocialLoginButtons';
import VerificationResendNotice from './VerificationResendNotice';

interface LoginFormProps {
  /** The template's auth CSS module. */
  styles: Readonly<Record<string, string>>;
  /** Optional social-chrome module override (craft); classic uses the default. */
  socialStyles?: Readonly<Record<string, string>>;
  form: ReturnType<typeof useLoginForm>;
}

/**
 * The login form body — error block, email/password fields, submit, the
 * register switch link, and social sign-in. Shared by the classic and craft
 * `LoginPage`s (which supply only the surrounding chrome + heading), so the two
 * differ only in CSS. The `<form>` is labelled by the page's `#login-heading`.
 */
export default function LoginForm({ styles, socialStyles, form }: Readonly<LoginFormProps>) {
  const { t } = form;
  return (
    <>
      <form onSubmit={form.handleSubmit} noValidate aria-labelledby="login-heading">
        {form.error && (
          <div className={styles.errorMessage} role="alert">
            <p>{form.error}</p>
            {form.needsVerification && (
              <VerificationResendNotice
                resendLoading={form.resendLoading}
                resendMessage={form.resendMessage}
                resendSucceeded={form.resendSucceeded}
                onResend={form.handleResendVerification}
                styles={styles}
              />
            )}
          </div>
        )}
        <AuthField
          styles={styles}
          id="email"
          name="email"
          label={t('email', 'Email')}
          type="email"
          value={form.email}
          onChange={(e) => form.setEmail(e.target.value)}
          ariaRequired
          inputRef={form.emailInputRef}
          autoComplete="email"
        />
        <AuthField
          styles={styles}
          id="password"
          name="password"
          label={t('password_label', 'Password')}
          type="password"
          value={form.password}
          onChange={(e) => form.setPassword(e.target.value)}
          ariaRequired
          autoComplete="current-password"
        />
        <button type="submit" className={styles.submitButton}>
          {t('login_button', 'Login')}
        </button>
      </form>
      <p className={styles.switchFormText}>
        {t('dont_have_account_auth', "Don't have an account?")}{' '}
        <Link href="/auth/register">{t('register_here', 'Register here')}</Link>
      </p>
      <SocialLoginButtons styles={socialStyles} />
    </>
  );
}
