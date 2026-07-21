'use client';

import Link from 'next/link';
import { Mail, CheckCircle, ArrowRight } from 'lucide-react';
import type { useRegisterForm } from '@/hooks/auth/useRegisterForm';

interface RegisterSuccessCardProps {
  /** The template's register-success CSS module. */
  styles: Readonly<Record<string, string>>;
  form: ReturnType<typeof useRegisterForm>;
}

/**
 * The post-registration "verify your email" screen. Shared by the classic and
 * craft `RegisterPage`s (each passing its own success CSS module), so the two
 * differ only in look. Rendered only in the success state (not screenshotted).
 */
export default function RegisterSuccessCard({ styles, form }: Readonly<RegisterSuccessCardProps>) {
  const { t, formData, resendLoading, resendMessage, handleResendEmail } = form;
  return (
    <div className={styles.successContainer}>
      <div className={styles.successCard}>
        <div className={styles.successContent}>
          <div className={styles.emailIconWrapper}>
            <Mail size={60} />
            <div className={styles.checkmark}>
              <CheckCircle size={24} />
            </div>
          </div>

          <h1 className={styles.successTitle}>{t('registration_successful', 'Registration Successful!')}</h1>

          <div className={styles.instructionsBox}>
            <p className={styles.instructionsText}>
              {t('verify_email_instructions', 'We have sent a verification email to')}
            </p>
            <div className={styles.emailHighlight}>{formData.email}</div>

            <ul className={styles.stepsList}>
              <li>
                <span className={styles.stepNumber}>1</span>
                <span>{t('check_inbox', 'Check your inbox (and spam folder)')}</span>
              </li>
              <li>
                <span className={styles.stepNumber}>2</span>
                <span>{t('click_verification_link', 'Click the verification link in the email')}</span>
              </li>
              <li>
                <span className={styles.stepNumber}>3</span>
                <span>{t('complete_verification', 'Complete the verification to activate your account')}</span>
              </li>
            </ul>
          </div>

          {resendMessage && (
            <div className={styles.resendMessage}>
              <CheckCircle size={18} />
              <span>{resendMessage}</span>
            </div>
          )}

          <div className={styles.buttonGroup}>
            <Link href="/auth/login" className={styles.loginButton}>
              {t('go_to_login', 'Go to Login')}
              <ArrowRight size={18} />
            </Link>
            <button type="button" onClick={handleResendEmail} disabled={resendLoading} className={styles.resendButton}>
              <Mail size={18} />
              {resendLoading ? t('sending', 'Sending...') : t('resend_email', 'Resend Email')}
            </button>
          </div>

          <p className={styles.helpText}>
            {t('didnt_receive_email', "Didn't receive the email?")}{' '}
            {t('check_spam_or_contact', 'Please check your spam folder.')}
          </p>
        </div>
      </div>
    </div>
  );
}
