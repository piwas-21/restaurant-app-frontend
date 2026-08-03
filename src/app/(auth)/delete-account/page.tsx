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
    } catch {
      // IGNORED ON PURPOSE — `confirmAccountDeletion` is a raw `fetch` returning `response.json()`
      // for EVERY status, so a refusal resolves into the branch above and never throws. What is
      // left is a dead network (`TypeError`) or a non-JSON body (`SyntaxError`); both texts are
      // client-authored and must not be rendered, so the generic sentence is all we can say.
      setStatus('error');
      setErrorMessage(t('unexpected_error', 'An unexpected error occurred.'));
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
