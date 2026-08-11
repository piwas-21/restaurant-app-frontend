import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { requestAccountDeletion } from '@/services/authService';
import { serverMessage } from '@/utils/apiFormErrors';
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
        // `serverMessage`, not `response.message`: `RequestAccountDeletionCommandHandler` returns
        // `ApiResponse.Failure("User not found")`, and that overload puts the reason in `errors[0]`
        // while `Message` is filled from the factory's own default parameter, the literal
        // "Operation failed" (ApiResponse.cs). So the `||` here
        // never reached the translated fallback — it printed the server's placeholder summary.
        setErrorMessage(
          serverMessage(response) ?? t('delete_account_request_failed', 'Failed to request account deletion.'),
        );
      }
    } catch (error) {
      // #414 closed the hole this catch used to document. `requestAccountDeletion` goes through
      // `apiClient` now, so a non-2xx arrives as an `ApiError` carrying its status.
      //
      // What actually reaches here, checked against the endpoint rather than assumed — the first
      // draft of this comment named a 429 and a 502, and NEITHER can occur:
      //
      //   - an EXPIRED TOKEN (the endpoint is `[Authorize]`). This is the #414 case. `apiClient`
      //     refreshes and retries; on a dead session it clears the tokens and navigates to `/`.
      //     `ApiError(401, '')` carries no words, so the fallback below is what would render — and
      //     assigning `location.href` does not halt this task, so React does commit that state
      //     before the page unloads;
      //   - a 500, whose message is the middleware's own English sentence;
      //   - a dead network (`TypeError`), which authors nothing showable.
      //
      // NOT a 429: `UserController` rate-limits `register` only. NOT a 502: the handler wraps its
      // email send in its own catch and treats delivery as non-fatal, so `EmailDeliveryException`
      // never escapes. The handler's own refusal ("User not found") is an HTTP 200 and stays on the
      // branch above.
      //
      // `serverMessage` yields nothing for the `TypeError` or the body-less 401, so the translated
      // fallback covers exactly the cases where it is the honest answer.
      setErrorMessage(serverMessage(error) ?? t('unexpected_error', 'An unexpected error occurred.'));
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
