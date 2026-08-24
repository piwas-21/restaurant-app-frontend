import type { TFunction } from 'i18next';
import type { VariantType } from 'notistack';
import {
  ReservationStatus,
  type TableDto,
  type TimeSlotDto,
  type CreateReservationDto,
  type ReservationDto,
  type UpdateMyReservationDto,
} from '@/types/reservation';
import { DEFAULT_FORM_FIELD_RULES, FORM_KEYS, type FormFieldRules } from '@/types/formFieldConfig';
import { problemFieldErrors, serverMessages } from '@/utils/apiFormErrors';
import { PROBLEM_BODY_KEY, problemFieldName } from '@/utils/problemDetails';
import { RESERVATION_GUEST_CAP, RESERVATION_GUEST_MIN } from '@/lib/reservationLimits';

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
 * Does the party exceed EVERY table in the restaurant? Depends only on the table
 * list and the party size — no date, no time, no availability call — which is why
 * it lives on its own: the notice it drives must appear the moment the guest count
 * is raised, not once a slot has been picked (the warning used to be reachable
 * only through `computeTableAvailability`, i.e. after date AND time).
 */
export function partyExceedsEveryTable(allTables: TableDto[], numberOfGuests: number): boolean {
  if (allTables.length === 0) {
    return false;
  }
  return numberOfGuests > Math.max(...allTables.map((tbl) => tbl.maxGuests));
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
  // Also surfaced independently of date/time by the hook — kept here so a slot
  // change cannot clear a warning that is still true.
  if (partyExceedsEveryTable(allTables, numberOfGuests)) {
    capacityWarning = getCapacityWarningMessage(t, numberOfGuests);
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

/**
 * May the GUEST still change this booking themselves?
 *
 * Two conditions, both of which the server enforces again on
 * `PUT /api/reservations/{id}/mine` — this only decides whether to OFFER the action:
 *  - the status is one the customer may still touch (pending or confirmed; a cancelled,
 *    completed or no-show booking is closed), and
 *  - the booking is not in the past.
 *
 * "Past" is measured against the day the RESTAURANT is on, never the device's (CLAUDE.md §5.15):
 * a guest sitting in Sydney must not lose the action on a Geneva booking because their own
 * calendar has already rolled over. `tenantToday` is `''` until that day is known, and while it is
 * unknown the answer is `false` — offering an edit and having the server refuse it is worse than
 * an action that appears a moment later.
 */
export function isCustomerEditableReservation(
  reservation: Pick<ReservationDto, 'status' | 'reservationDate'>,
  tenantToday: string,
): boolean {
  if (!tenantToday) return false;
  if (reservation.status !== ReservationStatus.Pending && reservation.status !== ReservationStatus.Confirmed) {
    return false;
  }
  // Both sides are `YYYY-MM-DD` day strings, compared as text: no `Date`, so no zone can shift the
  // comparison. The wire value may carry a time part (`2026-10-24T00:00:00Z`) — slice it off.
  return reservation.reservationDate.slice(0, 10) >= tenantToday;
}

/**
 * The times to offer a guest who is MOVING an existing booking.
 *
 * Keyed on the booking's OWN table, which is the whole difference from {@link getTimeSlotOptions}:
 * that one asks whether the tables the guest just picked are free, and this surface has no table
 * picker — `PUT /api/reservations/{id}/mine` carries no `tableId` and the backend **never re-seats
 * the party** (contract §2.2). It refuses a slot overlapping another booking on that one table, so
 * the only slot worth offering is one where that same table is free.
 *
 * `keepTime` is the booking's own current start, and it is load-bearing: the table is occupied at
 * that time BY THIS RESERVATION, so the slot the guest is already in comes back without it and
 * would otherwise render disabled — locking them out of changing only the party size or the note.
 */
export function getSelfServiceTimeSlotOptions(
  availableTimeSlots: TimeSlotDto[],
  tableId: string,
  keepTime?: string,
): TimeSlotOption[] {
  return availableTimeSlots.map((slot) => {
    const time = slot.startTime.substring(0, 5);
    return {
      time,
      available: time === keepTime || slot.availableTables.some((tbl) => tbl.id === tableId),
    };
  });
}

/** `HH:mm` or `HH:mm:ss` → `HH:mm:ss`, the only shape a .NET `TimeSpan` binds. */
function toWireTime(time: string): string {
  // No default for `hours`: `split` always yields a first element, so one would be a branch
  // nothing can take. The other two are real — the fallback below builds an `HH:mm`.
  const [hours, minutes = '00', seconds = '00'] = time.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
}

/**
 * When the moved booking ends: the chosen slot's own end, or — if the slot list does not contain
 * it — the same two-hour sitting `buildReservationPayload` assumes when booking.
 */
export function resolveSlotEndTime(startTime: string, availableTimeSlots: TimeSlotDto[]): string {
  const slot = availableTimeSlots.find((candidate) => candidate.startTime.startsWith(startTime));
  if (slot) return toWireTime(slot.endTime);

  const [hours, minutes = '00'] = startTime.split(':');
  return toWireTime(`${String((Number(hours) + 2) % 24).padStart(2, '0')}:${minutes}`);
}

/** What the guest typed into the self-update form, before it is put on the wire. */
export interface MyReservationUpdateInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  specialRequests: string;
  /** `YYYY-MM-DD`, straight from the date strip — never a day a `Date` decided. */
  reservationDate: string;
  /** `HH:mm` as picked. */
  startTime: string;
  /** `HH:mm:ss`, from {@link resolveSlotEndTime}. */
  endTime: string;
  numberOfGuests: number;
}

/**
 * The `PUT /api/reservations/{id}/mine` body.
 *
 * The times go out as LOCAL `"HH:mm:ss"` wall-clock strings and are never run through
 * `toISOString()`: the backend binds them to `TimeSpan`, which refuses an ISO datetime outright,
 * and UTC-converting them first moves the booking by the client's offset — the mobile client
 * shipped exactly that and every edit landed an hour or two out.
 *
 * `reservationDate` is the day string widened to UTC midnight — `YYYY-MM-DDT00:00:00Z`, the exact
 * shape the contract documents. The endpoint REFUSES any other time-of-day with a 400 rather than
 * risk a silent one-day shift, so a local midnight carrying an offset (`…T00:00:00+02:00`) is not
 * merely discouraged, it is rejected. Built by concatenation so no `Date` — and therefore no device
 * timezone — can pick a different day than the one on the button the guest pressed.
 */
export function buildMyReservationUpdatePayload(input: MyReservationUpdateInput): UpdateMyReservationDto {
  return {
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail.trim(),
    customerPhone: input.customerPhone.trim() || '',
    reservationDate: `${input.reservationDate}T00:00:00Z`,
    startTime: toWireTime(input.startTime),
    endTime: toWireTime(input.endTime),
    numberOfGuests: input.numberOfGuests,
    specialRequests: input.specialRequests.trim() || null,
  };
}

/**
 * Extracts the most specific API error message from a failed reservation create.
 *
 * **Its first two branches read an envelope the app has never produced.** It unwrapped
 * `err.response.data.errors` and `err.response.data.message` — the axios error shape — and axios
 * is not a dependency here, so both were dead, and its `!== 'Request failed with status code 400'`
 * guard filtered axios's wording rather than `apiClient`'s. Every real failure fell through to the
 * last branch, which read `err.message`.
 *
 * **What that showed a guest, measured against the backend rather than assumed:**
 * `CreateReservationCommand` answers with `ApiResponse.Failure("Table 5 is not available for the
 * selected time slot")` — the ONE-argument overload, which puts the reason in `Errors[0]` and
 * leaves `Message` at its default, the literal `"Operation failed"` (`ApiResponse.cs:55-63`).
 * `ReservationsController` returns `BadRequest(result)`, so it arrives as
 * `ApiError(400, 'Operation failed', ['Table 5 is not available…'])`. The old code read `message`
 * and printed **"Operation failed"** to the guest — and its own `!== 'Operation failed'` filter sat
 * on the dead axios branch, never on this one. `errors[]`, where the reason actually was, was never
 * read at all. Its tests could not see any of it: they hand-built the envelope.
 *
 * `serverMessages` reads what `createReservation` actually throws — an `ApiError`, from a non-2xx
 * or from `refused()` on a `{ success: false }` resolved inside a 200 — errors[] first, then the
 * summary, blanks dropped.
 *
 * `'Operation failed'` is still filtered: it is the backend's generic wrapper, less informative
 * than the translated sentence it would replace.
 */
export function extractReservationErrorMessage(err: unknown, t: TFunction): string {
  return serverReservationMessage(err, t) ?? t('reservation_failed', 'Failed to create reservation');
}

/**
 * A sentence a GUEST can act on for the `ValidationProblemDetails` half of a refusal, or `null`
 * when this failure is not one (see `utils/problemDetails.ts` for the two shapes).
 *
 * Only the fields whose own message is unfit to show are translated here; everything else keeps
 * the server's prose, which is specific and therefore worth more than a translated generic:
 *
 *  - **`NumberOfGuests`** — its only rule is `[Range(1, 20)]`, so one sentence is always true, and
 *    the server's own ("The field NumberOfGuests must be between 1 and 20.") names a C# property.
 *  - **`"$"`** — the JSON deserializer's message quotes a .NET type name and the missing member in
 *    developer English. It must never reach a guest.
 *  - **`CustomerEmail`** — `[Required]`, `[EmailAddress]` and `[MaxLength(255)]` all mean the same
 *    thing to a guest: the address as typed cannot be used.
 *
 * `CustomerName` is deliberately NOT mapped even though it looks like the same case: it carries
 * `[Required]` AND `[MaxLength(100)]`, so "Name is required" would be a lie for the second, and
 * telling the two apart means substring-matching English the contract says is not stable
 * (`mobile-client-contracts.md` §0.1). Its server sentence names the field plainly enough.
 */
function reservationProblemMessage(err: unknown, t: TFunction): string | null {
  const fields = problemFieldErrors(err);
  if (!fields) return null;

  // No emptiness guard on the join: `parseProblemFieldErrors` returns `null` — never `{}` — for a
  // body with nothing usable in it, so the only way here is with at least one message. A `''` from
  // a hand-built error is falsy anyway and the caller falls through to the envelope path.
  return Object.entries(fields)
    .map(([key, messages]) => translateProblemField(problemFieldName(key), t) ?? messages.join('; '))
    .join('; ');
}

/** The guest-facing sentence for one refused DTO member, or `null` to keep the server's own. */
function translateProblemField(field: string, t: TFunction): string | null {
  switch (field) {
    case 'numberofguests':
      return t('reservation_error_guest_range', 'Please choose between {{min}} and {{max}} guests.', {
        min: RESERVATION_GUEST_MIN,
        max: RESERVATION_GUEST_CAP,
      });
    case 'customeremail':
      return t('reservation_validation_email_invalid', 'Please enter a valid email');
    case PROBLEM_BODY_KEY:
      return t(
        'reservation_error_incomplete_request',
        'Some booking details were missing. Please reload the page and try again.',
      );
    default:
      return null;
  }
}

/**
 * What the SERVER said about a refused reservation call, or `null` when it said nothing worth
 * showing — so the caller supplies its own translated sentence instead.
 *
 * `filter` where the create path used to `find`: since backend #291 a validator failure arrives as
 * one entry PER BROKEN RULE, so taking the first non-generic one showed the guest one reason and
 * dropped the rest. Joined with the backend's own `'; '`.
 *
 * `'Operation failed'` is dropped: it is `ApiResponse.Failure(reason)`'s default `Message` — the
 * generic wrapper around the real reason, which is in `errors[0]` — and it is less informative
 * than the translated sentence it would otherwise displace.
 */
export function serverReservationMessage(err: unknown, t: TFunction): string | null {
  // problem+json FIRST: on a `[Range]`/`[Required]`/`[EmailAddress]` failure the model binder
  // answers before the handler runs, so this shape is the only one that arrives — and until #557
  // its messages reached the guest as raw DataAnnotation prose naming a C# property, or as the
  // deserializer's stringified type name. `t` is threaded through for exactly these.
  const problem = reservationProblemMessage(err, t);
  if (problem) return problem;

  const specific = serverMessages(err).filter((m) => m !== 'Operation failed');
  return specific.length > 0 ? specific.join('; ') : null;
}
