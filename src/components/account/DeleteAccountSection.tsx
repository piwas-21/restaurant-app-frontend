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
    } catch {
      // IGNORED ON PURPOSE — `requestAccountDeletion` is a raw `fetch` returning `response.json()`
      // for EVERY status, so a refusal resolves into the branch above rather than throwing. What
      // reaches here is a dead network (`TypeError`) or a non-JSON body (`SyntaxError`); both
      // texts are client-authored and must not be rendered, so the generic sentence is all there
      // honestly is to say AT THIS CATCH.
      //
      // The limit of that, stated rather than hidden: an EXPIRED TOKEN lands here too. The
      // endpoint is `[Authorize]`, its 401 has an empty body, and `.json()` rejects on it — so a
      // customer whose session lapsed while this page was open reads "an unexpected error" and
      // will retry forever, when the answer is "sign in again". The status that says so is in
      // hand in `authService.requestAccountDeletion` and discarded there, before `.json()` is
      // called. Fixing it means changing that producer to report the status, which is a wider
      // change than this slice: tracked as frontend #414.
      setErrorMessage(t('unexpected_error', 'An unexpected error occurred.'));
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
