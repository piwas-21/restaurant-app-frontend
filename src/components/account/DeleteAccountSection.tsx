import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { requestAccountDeletion } from '@/services/authService';
import { serverMessages } from '@/utils/apiFormErrors';
import styles from './DeleteAccountSection.module.css';

export default function DeleteAccountSection() {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleDeleteRequest = async () => {
    setIsDeleting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await requestAccountDeletion();
      if (response.success) {
        setSuccessMessage(
          t(
            'delete_account_request_success',
            'We sent a confirmation email. Please check your inbox to proceed with deletion.',
          ),
        );
      } else {
        // `serverMessages`, not `response.message`: `RequestAccountDeletionCommandHandler` returns
        // `ApiResponse.Failure("User not found")`, and that overload puts the reason in `errors[0]`
        // while `Message` is filled from the factory's own default parameter, the literal
        // "Operation failed" (ApiResponse.cs). So the `||` here
        // never reached the translated fallback — it printed the server's placeholder summary.
        setErrorMessage(
          serverMessages(response)[0] ?? t('delete_account_request_failed', 'Failed to request account deletion.'),
        );
      }
    } catch (error) {
      // #414 closed the hole this catch used to document. `requestAccountDeletion` now goes through
      // `apiClient`, so a non-2xx arrives as an `ApiError` carrying its status:
      //
      //   - an EXPIRED TOKEN (the endpoint is `[Authorize]`) is refreshed and retried, and on a
      //     genuinely dead session `apiClient` signs the customer out and sends them to the login
      //     route. They no longer read "an unexpected error" and retry forever. Nothing is rendered
      //     from here on that path because the page has already navigated away;
      //   - anything the SERVER authored — a 502's "The email could not be delivered…", a rate
      //     limiter's "Too many requests…" — is now shown instead of being replaced by the generic
      //     sentence, which is the difference between retrying and giving up.
      //
      // `serverMessages` still yields nothing for a dead network (`TypeError`) or a body-less 401,
      // and those texts are client-authored and must not be rendered — so the translated fallback
      // remains, for exactly the cases where it is the honest answer.
      setErrorMessage(serverMessages(error)[0] ?? t('unexpected_error', 'An unexpected error occurred.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className={styles.dangerZone}>
      <div className={styles.dangerZoneHeader}>
        <div className={styles.dangerZoneIcon}>
          <AlertTriangle size={20} />
        </div>
        <h2 className={styles.dangerZoneTitle}>{t('danger_zone_title', 'Danger Zone')}</h2>
      </div>

      <div className={styles.dangerZoneContent}>
        <p className={styles.warningText}>
          {t('delete_account_warning', 'Once you delete your account, there is no going back. Please be certain.')}
        </p>

        <ul className={styles.infoList}>
          <li>{t('delete_account_info_1', 'All your personal data will be permanently removed')}</li>
          <li>{t('delete_account_info_2', 'Your order history will be anonymized')}</li>
          <li>{t('delete_account_info_3', 'Active reservations will be cancelled')}</li>
          <li>{t('delete_account_info_4', 'This action cannot be undone')}</li>
        </ul>

        {successMessage && (
          <div className={`${styles.alertBox} ${styles.success}`}>
            <CheckCircle size={20} className={styles.alertIcon} />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className={`${styles.alertBox} ${styles.error}`}>
            <XCircle size={20} className={styles.alertIcon} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className={styles.buttonContainer}>
          <button onClick={handleDeleteRequest} disabled={isDeleting} className={styles.deleteButton}>
            <Trash2 size={18} />
            {isDeleting ? t('processing', 'Processing...') : t('delete_account_button', 'Delete My Account')}
          </button>
          <span className={styles.helpText}>{t('delete_account_help', 'You will receive a confirmation email')}</span>
        </div>
      </div>
    </section>
  );
}
