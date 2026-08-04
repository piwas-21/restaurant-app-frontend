'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2, CheckCircle, XCircle, X } from 'lucide-react';
import { confirmAccountDeletion } from '@/services/authService';
import { serverMessages } from '@/utils/apiFormErrors';
import styles from './DeleteAccount.module.css';

function DeleteAccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const token = searchParams.get('token');
  const userId = searchParams.get('userId');

  const [status, setStatus] = useState<'confirming' | 'processing' | 'success' | 'error'>('confirming');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token || !userId) {
      setStatus('error');
      setErrorMessage(t('invalid_deletion_link', 'Invalid deletion link. Missing parameters.'));
    }
  }, [token, userId, t]);

  const handleConfirmDelete = async () => {
    if (!token || !userId) return;

    setStatus('processing');
    try {
      const response = await confirmAccountDeletion({ userId, token });
      if (response.success) {
        setStatus('success');
        // Clear local storage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
        }
        setTimeout(() => {
          router.push('/auth/login');
        }, 3000);
      } else {
        setStatus('error');
        // `serverMessages`, not `response.message`, and the backend is why: every arm of
        // `ConfirmAccountDeletionCommandHandler` returns `ApiResponse.Failure("<the reason>")`,
        // whose one-argument overload puts that reason in `errors[0]` and fills `Message` from the
        // factory's own default PARAMETER — the literal "Operation failed" (ApiResponse.cs). So
        // `response.message`
        // was never empty and the `||` fallback never fired: a customer following an expired
        // deletion link was shown "Operation failed" instead of "Invalid or expired deletion
        // token", on a one-shot emailed link where knowing to request a new one is the whole fix.
        // `serverMessages` reads `errors[]` first, which is where the sentence actually is.
        setErrorMessage(serverMessages(response)[0] ?? t('deletion_failed', 'Failed to delete account.'));
      }
    } catch (error) {
      // #414: `confirmAccountDeletion` goes through `apiClient` now, so a non-2xx arrives as an
      // `ApiError` carrying its status instead of being flattened into the generic sentence.
      //
      // The reasons a guest actually sees are NOT here: all four of
      // `ConfirmAccountDeletionCommandHandler`'s refusals — including the expired-token one this
      // one-shot emailed link exists to explain — are `ApiResponse.Failure` returned inside
      // `Ok(...)`, i.e. HTTP 200, and stay on the branch above. That branch is the load-bearing one.
      //
      // This catch takes a 500 (the middleware's own English sentence), a validation 400, or a dead
      // network. Checked, not assumed: this handler sends NO email, so the 502 an earlier draft of
      // this comment named cannot occur. A `TypeError`/`SyntaxError` authors nothing showable and
      // those texts must not be rendered — hence the fallback.
      setStatus('error');
      setErrorMessage(serverMessages(error)[0] ?? t('unexpected_error', 'An unexpected error occurred.'));
    }
  };

  const handleCancel = () => {
    router.push('/account');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconContainer}>
            <AlertTriangle size={40} />
          </div>
          <h1 className={styles.title}>{t('delete_account_title', 'Delete Account')}</h1>
          <p className={styles.subtitle}>{t('delete_account_subtitle', 'Final Confirmation')}</p>
        </div>

        <div className={styles.content}>
          {status === 'confirming' && (
            <div className={styles.stateContainer}>
              <div className={styles.warningBox}>
                <p className={styles.warningText}>
                  {t(
                    'delete_account_confirmation_text',
                    'Are you absolutely sure you want to permanently delete your account? This action cannot be undone.',
                  )}
                </p>
                <ul className={styles.consequencesList}>
                  <li>
                    <XCircle size={18} />
                    <span>{t('delete_consequence_1', 'All your personal data will be permanently removed')}</span>
                  </li>
                  <li>
                    <XCircle size={18} />
                    <span>{t('delete_consequence_2', 'Your order history will be anonymized')}</span>
                  </li>
                  <li>
                    <XCircle size={18} />
                    <span>{t('delete_consequence_3', 'Active reservations will be cancelled')}</span>
                  </li>
                  <li>
                    <XCircle size={18} />
                    <span>{t('delete_consequence_4', 'You will lose access to all loyalty points')}</span>
                  </li>
                </ul>
              </div>

              <div className={styles.buttonGroup}>
                <button onClick={handleConfirmDelete} className={styles.confirmButton}>
                  <Trash2 size={20} />
                  {t('confirm_delete_button', 'Yes, Delete My Account')}
                </button>
                <button onClick={handleCancel} className={styles.cancelButton}>
                  <X size={20} />
                  {t('cancel_button', 'Cancel')}
                </button>
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className={styles.stateContainer}>
              <div className={styles.spinner}></div>
              <p className={styles.processingText}>{t('deleting_account', 'Deleting your account...')}</p>
            </div>
          )}

          {status === 'success' && (
            <div className={styles.stateContainer}>
              <div className={styles.successIcon}>
                <CheckCircle size={40} />
              </div>
              <h2 className={styles.successTitle}>{t('account_deleted', 'Account Deleted')}</h2>
              <p className={styles.successMessage}>
                {t(
                  'account_deleted_message',
                  'Your account has been permanently deleted. You will be redirected to the login page shortly.',
                )}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className={styles.stateContainer}>
              <div className={styles.errorIcon}>
                <XCircle size={40} />
              </div>
              <h2 className={styles.errorTitle}>{t('error', 'Error')}</h2>
              <p className={styles.errorMessage}>{errorMessage}</p>
              <button onClick={() => router.push('/auth/login')} className={styles.backButton}>
                {t('go_to_login', 'Go to Login')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DeleteAccountPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DeleteAccountContent />
    </Suspense>
  );
}
