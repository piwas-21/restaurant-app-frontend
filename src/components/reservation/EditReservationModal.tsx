'use client';

import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import GuestSelector from '@/components/reservation/GuestSelector';
import DateTimeSelector from '@/components/reservation/DateTimeSelector';
import CustomerDetailsForm from '@/components/reservation/CustomerDetailsForm';
import { useEditReservation } from '@/hooks/reservations/useEditReservation';
import type { ReservationDto } from '@/types/reservation';
import styles from './EditReservationModal.module.css';

type CssModule = Readonly<Record<string, string>>;

interface EditReservationModalProps {
  /** The booking being changed. Mount this component only for an editable one. */
  reservation: ReservationDto;
  onClose: () => void;
  /** Refetch the list — the booking behind the modal is stale the moment a save lands. */
  onSaved: () => void;
  /**
   * The host template's party-size and date/time skins (the ReservationsPageLayout pattern), so
   * the picker inside this dialog looks like the booking page of the same template. The dialog
   * shell itself is BaseModal's, and the form chrome is this component's own module.
   */
  styles: {
    guests: CssModule;
    dateTime: CssModule;
  };
}

/**
 * A guest changing their own booking — date, time, party size, contact details and note.
 *
 * The three controls are the BOOKING page's own (`GuestSelector`, `DateTimeSelector`,
 * `CustomerDetailsForm`) rather than a second set: the picker is driven by the same
 * available-slots query, so a guest can only move onto a slot the restaurant really has free.
 * There is no table picker and no status control — the server re-seats the party and owns the
 * status (`PUT /api/reservations/{id}/mine` carries neither field).
 *
 * Mounted only while open (the parent renders it on an edit target), so opening a second booking
 * gets a fresh prefill rather than the previous one's leftovers.
 */
export default function EditReservationModal({
  reservation,
  onClose,
  onSaved,
  styles: templateStyles,
}: Readonly<EditReservationModalProps>) {
  const { t } = useTranslation();
  const edit = useEditReservation(reservation, onSaved);

  const footer = edit.saved ? (
    <button type="button" className={styles.confirmButton} onClick={onClose}>
      {t('close', 'Close')}
    </button>
  ) : (
    <>
      <button type="button" className={styles.cancelButton} onClick={onClose} disabled={edit.saving}>
        {t('cancel', 'Cancel')}
      </button>
      <button
        type="button"
        className={styles.confirmButton}
        onClick={() => void edit.save()}
        disabled={edit.saving || !edit.canSave}
      >
        {edit.saving ? t('edit_reservation_saving', 'Saving...') : t('edit_reservation_save', 'Save changes')}
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={t('edit_reservation_title', 'Change your booking')}
      size="lg"
      footer={footer}
    >
      {edit.saved ? (
        // `<output>`, not a `role="status"` div — it carries the status role implicitly, which is
        // the house convention here (CartContents, FidelityPointsCheckout, SuggestedSideItemsPicker)
        // and what SonarCloud S6819 asks for. `.success` is display:block so the paragraphs stack.
        <output className={styles.success}>
          <p>{t('edit_reservation_success', 'Your booking has been updated.')}</p>
          {edit.needsApproval && (
            <p>
              {t(
                'edit_reservation_needs_approval',
                'The restaurant has to approve the new time, so your booking is waiting for confirmation again. You will get an email as soon as it is confirmed.',
              )}
            </p>
          )}
        </output>
      ) : (
        <div className={styles.form}>
          <p className={styles.intro}>
            {t(
              'edit_reservation_intro',
              'Pick a new time or party size. You keep the same table, so a larger party may not fit.',
            )}
          </p>

          {edit.error && (
            <div className={styles.error} role="alert">
              <p>{edit.error}</p>
              <button type="button" onClick={edit.dismissError} aria-label={t('close', 'Close')}>
                &times;
              </button>
            </div>
          )}

          <GuestSelector
            numberOfGuests={edit.numberOfGuests}
            onGuestsChange={edit.setNumberOfGuests}
            styles={templateStyles.guests}
          />

          <DateTimeSelector
            selectedDate={edit.selectedDate}
            selectedTime={edit.selectedTime}
            onDateChange={edit.setSelectedDate}
            onTimeChange={edit.setSelectedTime}
            loading={edit.loadingSlots}
            today={edit.today}
            timeSlotOptions={edit.timeSlotOptions}
            styles={templateStyles.dateTime}
          />

          <CustomerDetailsForm
            customerName={edit.customerName}
            customerEmail={edit.customerEmail}
            customerPhone={edit.customerPhone}
            specialRequests={edit.specialRequests}
            onNameChange={edit.setCustomerName}
            onEmailChange={edit.setCustomerEmail}
            onPhoneChange={edit.setCustomerPhone}
            onSpecialRequestsChange={edit.setSpecialRequests}
          />
        </div>
      )}
    </BaseModal>
  );
}
