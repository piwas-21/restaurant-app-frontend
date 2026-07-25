'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import { useAuth } from '@/components/AuthContext';
import { reservationService } from '@/services/reservationService';
import {
  validateReservation,
  areRequiredReservationDetailsFilled,
  buildSpecialRequests,
  buildReservationPayload,
  extractReservationErrorMessage,
} from '@/utils/reservationForm';
import { useCustomerFormFields } from '@/hooks/useCustomerFormFields';
import { FORM_KEYS } from '@/types/formFieldConfig';
import { useReservationAvailability } from './useReservationAvailability';

/**
 * Orchestrates the reservations page: composes table/availability selection
 * ({@link useReservationAvailability}) with the customer-details form state and the submit flow.
 * The page component renders from this hook's return value (CLAUDE.md §5.1). Pure transforms live in
 * utils/reservationForm. Extracted from app/reservations/page.tsx (Sprint 4/6); behaviour unchanged.
 */
export function useReservationsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const availability = useReservationAvailability();
  const {
    selectedTableIds,
    setSelectedTableIds,
    bookedTableIds,
    allTables,
    capacityWarning,
    selectedDate,
    selectedTime,
    numberOfGuests,
  } = availability;

  // Admin-configured field visibility/requiredness (safe fallback = today's behaviour).
  const { rules: fieldRules } = useCustomerFormFields(FORM_KEYS.reservation);

  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState<string>('');
  const [requestCombineTables, setRequestCombineTables] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Prefill customer details from the logged-in user (phone not on the User interface).
  useEffect(() => {
    if (user) {
      setCustomerName(`${user.firstName} ${user.lastName}`.trim());
      setCustomerEmail(user.email || '');
    }
  }, [user]);

  const handleCloseSuccessModal = () => setShowSuccessModal(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationToast = validateReservation(
      {
        selectedTableIds,
        selectedDate,
        selectedTime,
        customerName,
        customerEmail,
        customerPhone,
        specialRequests,
        bookedTableIds,
        allTables,
      },
      t,
      fieldRules,
    );
    if (validationToast) {
      enqueueSnackbar(validationToast.message, { variant: validationToast.variant });
      return;
    }

    setSubmitting(true);

    try {
      const finalSpecialRequests = buildSpecialRequests({
        specialRequests,
        capacityWarning,
        numberOfGuests,
        selectedTableIds,
        requestCombineTables,
        allTables,
      });

      const reservationPromises = selectedTableIds.map((tableId) =>
        reservationService.createReservation(
          buildReservationPayload(
            tableId,
            selectedDate,
            selectedTime,
            numberOfGuests,
            { customerName, customerEmail, customerPhone },
            finalSpecialRequests,
          ),
        ),
      );

      await Promise.all(reservationPromises);

      setShowSuccessModal(true);

      // Reset the form but keep name + email (the user may book again).
      setSelectedTableIds([]);
      setRequestCombineTables(false);
      setSpecialRequests('');
    } catch (err) {
      const errorMessage = extractReservationErrorMessage(err, t);
      console.error('Reservation error:', (err as { response?: { data?: unknown } })?.response?.data || err);
      enqueueSnackbar(errorMessage, { variant: 'error', autoHideDuration: 6000 });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    selectedTableIds.length > 0 &&
    Boolean(selectedDate) &&
    Boolean(selectedTime) &&
    areRequiredReservationDetailsFilled({ customerName, customerEmail, customerPhone, specialRequests }, fieldRules);

  return {
    t,
    ...availability,
    customerName,
    setCustomerName,
    customerEmail,
    setCustomerEmail,
    customerPhone,
    setCustomerPhone,
    specialRequests,
    setSpecialRequests,
    requestCombineTables,
    setRequestCombineTables,
    submitting,
    canSubmit,
    handleSubmit,
    showSuccessModal,
    handleCloseSuccessModal,
  };
}
