'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reservationService } from '@/services/reservationService';
import { useReservationAvailability } from './useReservationAvailability';
import {
  areRequiredReservationDetailsFilled,
  buildMyReservationUpdatePayload,
  getSelfServiceTimeSlotOptions,
  resolveSlotEndTime,
  serverReservationMessage,
} from '@/utils/reservationForm';
import { useCustomerFormFields } from '@/hooks/useCustomerFormFields';
import { FORM_KEYS } from '@/types/formFieldConfig';
import { ReservationStatus, type ReservationDto } from '@/types/reservation';

/**
 * The guest changing their OWN booking — the state behind `EditReservationModal`.
 *
 * Deliberately built on the SAME availability hook the booking page uses
 * ({@link useReservationAvailability}), so a guest moving a booking is offered exactly the slots
 * `GET /api/reservations/available-slots` reports free, not a second, drifting idea of the
 * restaurant's opening hours. What it does NOT reuse is `timeSlotOptions`: that answers "are the
 * tables the guest picked free then?", and this surface has no table picker — the server re-seats
 * the party — so the options come from {@link getSelfServiceTimeSlotOptions} instead.
 *
 * The form is prefilled from the booking once, per booking id. Everything the guest may change is
 * local state until `save`; nothing is written until they press it.
 */
export function useEditReservation(reservation: ReservationDto, onSaved: () => void) {
  const { t } = useTranslation();
  const { rules: fieldRules } = useCustomerFormFields(FORM_KEYS.reservation);
  const {
    today,
    availableTimeSlots,
    selectedDate,
    setSelectedDate,
    selectedTime,
    setSelectedTime,
    numberOfGuests,
    setNumberOfGuests,
    loading,
  } = useReservationAvailability();

  const [customerName, setCustomerName] = useState(reservation.customerName);
  const [customerEmail, setCustomerEmail] = useState(reservation.customerEmail);
  const [customerPhone, setCustomerPhone] = useState(reservation.customerPhone ?? '');
  const [specialRequests, setSpecialRequests] = useState(reservation.specialRequests ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  /** The save dropped a Confirmed booking back to Pending, and NOTHING tells the guest but this. */
  const [needsApproval, setNeedsApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The booking's own start, kept offerable even when its table is (by itself) taken. */
  const originalTime = reservation.startTime.substring(0, 5);
  /** The wire day, read as text: `2026-10-24` and `2026-10-24T00:00:00Z` are the same day here. */
  const originalDate = reservation.reservationDate.slice(0, 10);

  // Prefill the date/time/party controls from the booking. They live in the availability hook (it
  // owns the fetch they drive), so they cannot be seeded through useState initialisers.
  useEffect(() => {
    setSelectedDate(originalDate);
    setSelectedTime(originalTime);
    setNumberOfGuests(reservation.numberOfGuests);
  }, [originalDate, originalTime, reservation.numberOfGuests, setSelectedDate, setSelectedTime, setNumberOfGuests]);

  const timeSlotOptions = getSelfServiceTimeSlotOptions(
    availableTimeSlots,
    // The party keeps its table — the endpoint carries no `tableId` and never re-seats anyone — so
    // a slot is only offerable when THAT table is free at it.
    reservation.tableId,
    // Only on the day the booking is already on: on any other date the slot has no special claim.
    selectedDate === originalDate ? originalTime : undefined,
  );

  const canSave =
    Boolean(selectedDate) &&
    Boolean(selectedTime) &&
    numberOfGuests > 0 &&
    areRequiredReservationDetailsFilled({ customerName, customerEmail, customerPhone, specialRequests }, fieldRules);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await reservationService.updateMyReservation(
        reservation.id,
        buildMyReservationUpdatePayload({
          customerName,
          customerEmail,
          customerPhone,
          specialRequests,
          reservationDate: selectedDate,
          startTime: selectedTime,
          endTime: resolveSlotEndTime(selectedTime, availableTimeSlots),
          numberOfGuests,
        }),
      );
      // Re-shaping a CONFIRMED booking (day, time or party size) sends it back to Pending — the
      // restaurant approved the old numbers, not the new ones — and the backend sends no mail to
      // anyone on this route, so the only place a guest can learn that is here.
      setNeedsApproval(
        reservation.status === ReservationStatus.Confirmed && updated.status === ReservationStatus.Pending,
      );
      setSaved(true);
      // The list behind the modal is stale the moment this succeeds.
      onSaved();
    } catch (err: unknown) {
      // The server's own sentence wins — it names the reason (slot gone, too late to change,
      // party too large). Only when it authored none do we say something of our own.
      setError(serverReservationMessage(err) ?? t('edit_reservation_error', 'Failed to update the reservation'));
    } finally {
      setSaving(false);
    }
  };

  return {
    t,
    today,
    selectedDate,
    setSelectedDate,
    selectedTime,
    setSelectedTime,
    numberOfGuests,
    setNumberOfGuests,
    timeSlotOptions,
    loadingSlots: loading,
    customerName,
    setCustomerName,
    customerEmail,
    setCustomerEmail,
    customerPhone,
    setCustomerPhone,
    specialRequests,
    setSpecialRequests,
    saving,
    saved,
    needsApproval,
    error,
    dismissError: useCallback(() => setError(null), []),
    canSave,
    save,
  };
}
