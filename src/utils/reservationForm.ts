import type { TFunction } from 'i18next';
import type { VariantType } from 'notistack';
import type { TableDto, TimeSlotDto, CreateReservationDto } from '@/types/reservation';
import { DEFAULT_FORM_FIELD_RULES, FORM_KEYS, type FormFieldRules } from '@/types/formFieldConfig';

const DEFAULT_RESERVATION_RULES = DEFAULT_FORM_FIELD_RULES[FORM_KEYS.reservation];

/** A snackbar to surface — returned by the pure helpers so the hook owns the side effect. */
export interface ReservationToast {
  message: string;
  variant: VariantType;
  autoHideDuration?: number;
}

/** The shared "no single table fits the party" capacity message (used in two places). */
export function getCapacityWarningMessage(t: TFunction, numberOfGuests: number): string {
  return t(
    'capacity_warning_message',
    "We don't have a single table that can accommodate all {{guests}} guests. However, you can select multiple tables and request to combine them, or proceed with your selection and our staff will review your request to find the best arrangement.",
    { guests: numberOfGuests },
  );
}

/**
 * Computes the booked-table ids and any capacity warning for the selected time slot. Mirrors the
 * former `updateTableAvailability`: `capacityWarning` is `null` when nothing should change (the
 * original only ever *set* the warning here, never cleared it).
 */
export function computeTableAvailability(
  selectedTime: string,
  availableTimeSlots: TimeSlotDto[],
  allTables: TableDto[],
  numberOfGuests: number,
  t: TFunction,
): { bookedTableIds: string[]; capacityWarning: string | null } {
  let bookedTableIds: string[];
  let capacityWarning: string | null = null;

  // API returns times like "12:00:00"; match on the selected HH:mm start.
  const slot = availableTimeSlots.find((s) => s.startTime.startsWith(selectedTime));

  if (slot) {
    const availableIds = new Set(slot.availableTables.map((tbl) => tbl.id));
    bookedTableIds = allTables.filter((tbl) => !availableIds.has(tbl.id)).map((tbl) => tbl.id);

    // Tables are available but none have sufficient capacity for the party.
    const tablesWithCapacity = slot.availableTables.filter((tbl) => tbl.maxGuests >= numberOfGuests);
    if (tablesWithCapacity.length === 0 && slot.availableTables.length > 0) {
      capacityWarning = getCapacityWarningMessage(t, numberOfGuests);
    }
  } else {
    // Selected time slot not in the list — treat every table as booked.
    bookedTableIds = allTables.map((tbl) => tbl.id);
  }

  // Guest size exceeds EVERY table in the restaurant (not just the available ones).
  if (allTables.length > 0) {
    const maxRestaurantCapacity = Math.max(...allTables.map((tbl) => tbl.maxGuests));
    if (numberOfGuests > maxRestaurantCapacity) {
      capacityWarning = getCapacityWarningMessage(t, numberOfGuests);
    }
  }

  return { bookedTableIds, capacityWarning };
}

/** A time chip in the picker: HH:mm plus whether every selected table is free then. */
export interface TimeSlotOption {
  time: string;
  available: boolean;
}

/**
 * The times to offer in the picker. EVERY slot is returned; a slot where any selected table is
 * busy is marked unavailable (rendered disabled + struck-through) instead of being filtered out.
 * With no tables selected every slot is available.
 */
export function getTimeSlotOptions(selectedTableIds: string[], availableTimeSlots: TimeSlotDto[]): TimeSlotOption[] {
  return availableTimeSlots.map((slot) => ({
    time: slot.startTime.substring(0, 5),
    available: selectedTableIds.every((selectedId) => slot.availableTables.some((tbl) => tbl.id === selectedId)),
  }));
}

/** The customer-detail values checked against the configured field rules. */
export interface ReservationDetailValues {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  specialRequests: string;
}

/**
 * True when every field the admin config marks visible + required is filled.
 * Mirrors the backend's config-required enforcement on reservation create so
 * users never hit the raw 400. Name/email are locked-required server-side, so
 * they are always checked; phone/special requests only when configured so.
 */
export function areRequiredReservationDetailsFilled(
  values: ReservationDetailValues,
  rules: FormFieldRules = DEFAULT_RESERVATION_RULES,
): boolean {
  return (Object.keys(values) as (keyof ReservationDetailValues)[]).every((key) => {
    const rule = rules[key] ?? DEFAULT_RESERVATION_RULES[key];
    return !(rule.isVisible && rule.isRequired) || values[key].trim().length > 0;
  });
}

/** Form inputs needed to validate a reservation before submit. */
export interface ReservationValidationInput extends ReservationDetailValues {
  selectedTableIds: string[];
  selectedDate: string;
  selectedTime: string;
  bookedTableIds: string[];
  allTables: TableDto[];
}

/**
 * Returns the first validation problem as a ready-to-show toast (preserving the original per-rule
 * variant — `warning` for missing fields, `error` for a now-unavailable table), or null when valid.
 * `rules` carries the admin-configured field requirements (default: registry defaults).
 */
export function validateReservation(
  input: ReservationValidationInput,
  t: TFunction,
  rules: FormFieldRules = DEFAULT_RESERVATION_RULES,
): ReservationToast | null {
  const {
    selectedTableIds,
    selectedDate,
    selectedTime,
    customerName,
    customerEmail,
    customerPhone,
    specialRequests,
    bookedTableIds,
    allTables,
  } = input;

  if (selectedTableIds.length === 0 || !selectedDate || !selectedTime) {
    return { message: t('please_complete_all_fields', 'Please complete all fields'), variant: 'warning' };
  }
  if (!areRequiredReservationDetailsFilled({ customerName, customerEmail, customerPhone, specialRequests }, rules)) {
    return { message: t('please_fill_customer_details', 'Please fill in your details'), variant: 'warning' };
  }

  // Re-validate table availability before submission.
  const unavailableTables = selectedTableIds.filter((id) => bookedTableIds.includes(id));
  if (unavailableTables.length > 0) {
    const tableNumbers = unavailableTables
      .map((id) => allTables.find((tbl) => tbl.id === id)?.tableNumber)
      .filter(Boolean)
      .join(', ');
    return {
      message: t(
        'selected_tables_not_available',
        'Selected table(s) {{tables}} are no longer available for this time slot. Please select different tables or time.',
        { tables: tableNumbers },
      ),
      variant: 'error',
    };
  }
  return null;
}

/** Inputs for assembling the special-requests note (capacity + combine annotations). */
export interface SpecialRequestsInput {
  specialRequests: string;
  capacityWarning: string;
  numberOfGuests: number;
  selectedTableIds: string[];
  requestCombineTables: boolean;
  allTables: TableDto[];
}

/** Prepends the capacity-review and combine-tables annotations onto the customer's note. */
export function buildSpecialRequests(input: SpecialRequestsInput): string {
  const { specialRequests, capacityWarning, numberOfGuests, selectedTableIds, requestCombineTables, allTables } = input;
  let finalSpecialRequests = specialRequests || '';

  if (capacityWarning) {
    finalSpecialRequests =
      `[CAPACITY REVIEW NEEDED: Requested ${numberOfGuests} guests but individual table capacity may be insufficient. Customer selected ${selectedTableIds.length} table(s). Please review and confirm if arrangement can accommodate party size.] ${finalSpecialRequests}`.trim();
  }

  if (requestCombineTables && selectedTableIds.length > 1) {
    const tableNumbers = selectedTableIds
      .map((id) => allTables.find((tbl) => tbl.id === id)?.tableNumber)
      .filter(Boolean)
      .join(', ');
    finalSpecialRequests = `[REQUEST TO COMBINE TABLES: ${tableNumbers}] ${finalSpecialRequests}`.trim();
  }

  return finalSpecialRequests;
}

/** Builds the per-table create-reservation payload (2-hour slot). */
export function buildReservationPayload(
  tableId: string,
  selectedDate: string,
  selectedTime: string,
  numberOfGuests: number,
  customer: { customerName: string; customerEmail: string; customerPhone: string },
  finalSpecialRequests: string,
): CreateReservationDto {
  return {
    customerName: customer.customerName,
    customerEmail: customer.customerEmail,
    customerPhone: customer.customerPhone.trim() || '', // Send empty string if empty
    tableId,
    reservationDate: new Date(selectedDate).toISOString(),
    startTime: `${selectedTime}:00`,
    endTime: `${parseInt(selectedTime.split(':')[0]) + 2}:00:00`, // 2-hour reservation
    numberOfGuests,
    specialRequests: finalSpecialRequests || null,
  };
}

/** Extracts the most specific API error message from a failed reservation create. */
export function extractReservationErrorMessage(err: unknown, t: TFunction): string {
  let errorMessage = t('reservation_failed', 'Failed to create reservation');

  const response = (err as { response?: { data?: { errors?: unknown; message?: string } } })?.response;
  const data = response?.data;

  if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    // Show the first specific error from the API errors array.
    errorMessage = String(data.errors[0]);
  } else if (data?.message && data.message !== 'Operation failed') {
    errorMessage = data.message;
  } else {
    const message = (err as { message?: string })?.message;
    if (message && message !== 'Request failed with status code 400') {
      errorMessage = message;
    }
  }

  return errorMessage;
}
