'use client';

import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface VerificationResendNoticeProps {
  resendLoading: boolean;
  resendMessage: string;
  resendSucceeded: boolean;
  onResend: () => void;
  /** The template's auth CSS module — supplies resendBlock / resendMessage /
   *  resendMessageSuccess / resendMessageError / resendButton. */
  styles: Readonly<Record<string, string>>;
}

/**
 * The "resend verification email" affordance shown inside the login error block
 * when a login is rejected for an unverified email. Shared by the classic and
 * craft `LoginPage` renderings — each passes its own CSS module (`styles`) so
 * the two differ only in look, not behaviour. Success/error colouring is driven
 * by `resendSucceeded` (not a locale-fragile message-substring check).
 */
export default function VerificationResendNotice({
  resendLoading,
  resendMessage,
  resendSucceeded,
  onResend,
  styles,
}: Readonly<VerificationResendNoticeProps>) {
  const { t } = useTranslation();

  return (
    <div className={styles.resendBlock}>
      {resendMessage && (
        <p
          className={`${styles.resendMessage} ${resendSucceeded ? styles.resendMessageSuccess : styles.resendMessageError}`}
        >
          {resendMessage}
        </p>
      )}
      <button type="button" onClick={onResend} disabled={resendLoading} className={styles.resendButton}>
        <Mail size={18} />
        {resendLoading ? t('sending', 'Sending...') : t('resend_verification_email', 'Resend Verification Email')}
      </button>
    </div>
  );
}
