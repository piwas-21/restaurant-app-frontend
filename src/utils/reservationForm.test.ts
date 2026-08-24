import type { TFunction } from 'i18next';
import { ReservationStatus, type TableDto, type TimeSlotDto } from '@/types/reservation';
// Through the ALIAS: `serverMessages` resolves `ApiError` the same way, and an instance built
// from anywhere else would make its `instanceof` false and every assertion below vacuous.
import { ApiError } from '@/utils/apiClient';
import {
  getCapacityWarningMessage,
  partyExceedsEveryTable,
  computeTableAvailability,
  getTimeSlotOptions,
  validateReservation,
  areRequiredReservationDetailsFilled,
  buildSpecialRequests,
  buildReservationPayload,
  extractReservationErrorMessage,
  isCustomerEditableReservation,
  getSelfServiceTimeSlotOptions,
  resolveSlotEndTime,
  buildMyReservationUpdatePayload,
  serverReservationMessage,
} from '@/utils/reservationForm';

// Minimal i18next stand-in: returns the developer fallback with {{vars}} filled
// from the interpolation options, so assertions read the real rendered string.
const t = ((_key: string, fallback: string, opts?: Record<string, unknown>) =>
  fallback.replace(/{{(\w+)}}/g, (_m, k: string) => String(opts?.[k] ?? ''))) as unknown as TFunction;

const makeTable = (partial: Partial<TableDto> & Pick<TableDto, 'id' | 'tableNumber' | 'maxGuests'>): TableDto => ({
  isActive: true,
  isOutdoor: false,
  positionX: 0,
  positionY: 0,
  ...partial,
});

const t1 = makeTable({ id: 'a', tableNumber: '1', maxGuests: 2 });
const t2 = makeTable({ id: 'b', tableNumber: '2', maxGuests: 4 });
const t3 = makeTable({ id: 'c', tableNumber: '3', maxGuests: 6 });

const slot = (startTime: string, availableTables: TableDto[]): TimeSlotDto => ({
  startTime,
  endTime: '',
  availableTables,
});

describe('getCapacityWarningMessage', () => {
  it('interpolates the guest count into the warning', () => {
    expect(getCapacityWarningMessage(t, 8)).toContain('8 guests');
  });
});

describe('computeTableAvailability', () => {
  it('marks tables missing from the matched slot as booked, no warning when capacity fits', () => {
    const slots = [slot('12:00:00', [t2, t3])]; // t1 not available
    const { bookedTableIds, capacityWarning } = computeTableAvailability('12:00', slots, [t1, t2, t3], 4, t);
    expect(bookedTableIds).toEqual(['a']);
    expect(capacityWarning).toBeNull();
  });

  it('warns when the slot has tables but none seat the party', () => {
    const slots = [slot('12:00:00', [t1, t2])]; // max 4
    const { capacityWarning } = computeTableAvailability('12:00', slots, [t1, t2, t3], 5, t);
    // t3 (6) is not in the slot, so no slot table seats 5 → warning.
    expect(capacityWarning).toContain('5 guests');
  });

  it('treats every table as booked when the selected time is not in the slot list', () => {
    const slots = [slot('12:00:00', [t1, t2])];
    const { bookedTableIds, capacityWarning } = computeTableAvailability('20:00', slots, [t1, t2, t3], 2, t);
    expect(bookedTableIds).toEqual(['a', 'b', 'c']);
    expect(capacityWarning).toBeNull();
  });

  it('warns when the party exceeds the whole restaurant capacity, isolated from the slot branch', () => {
    // Non-matching time → the slot branch never fires (all tables booked), so ONLY
    // the whole-restaurant overflow check (10 > max table 6) can set the warning.
    // Isolating it this way guards the branch against being silently deleted.
    const slots = [slot('12:00:00', [t1, t2, t3])];
    const { bookedTableIds, capacityWarning } = computeTableAvailability('20:00', slots, [t1, t2, t3], 10, t);
    expect(bookedTableIds).toEqual(['a', 'b', 'c']);
    expect(capacityWarning).toContain('10 guests');
  });

  it('does not crash and gives no warning when there are no tables', () => {
    const { bookedTableIds, capacityWarning } = computeTableAvailability('12:00', [], [], 2, t);
    expect(bookedTableIds).toEqual([]);
    expect(capacityWarning).toBeNull();
  });
});

describe('getTimeSlotOptions', () => {
  const slots = [slot('12:00:00', [t1, t2]), slot('13:00:00', [t2])];

  it('returns every slot as available HH:mm when no tables are selected', () => {
    expect(getTimeSlotOptions([], slots)).toEqual([
      { time: '12:00', available: true },
      { time: '13:00', available: true },
    ]);
  });

  it('keeps every slot but marks those where ANY selected table is busy as unavailable', () => {
    // t1 is only free at 12:00 → 13:00 stays in the list, struck as unavailable.
    expect(getTimeSlotOptions(['a', 'b'], slots)).toEqual([
      { time: '12:00', available: true },
      { time: '13:00', available: false },
    ]);
    expect(getTimeSlotOptions(['b'], slots)).toEqual([
      { time: '12:00', available: true },
      { time: '13:00', available: true },
    ]);
  });

  it('returns an empty list when the day has no slots', () => {
    expect(getTimeSlotOptions(['a'], [])).toEqual([]);
  });
});

describe('validateReservation', () => {
  const base = {
    selectedTableIds: ['a'],
    selectedDate: '2026-08-15',
    selectedTime: '12:00',
    customerName: 'Ada',
    customerEmail: 'ada@example.com',
    customerPhone: '',
    specialRequests: '',
    bookedTableIds: [] as string[],
    allTables: [t1, t2],
  };

  it('warns when table/date/time are incomplete', () => {
    const toast = validateReservation({ ...base, selectedTableIds: [] }, t);
    expect(toast).toEqual({ message: expect.stringContaining('complete all fields'), variant: 'warning' });
  });

  it('warns when customer details are missing', () => {
    const toast = validateReservation({ ...base, customerEmail: '' }, t);
    expect(toast?.variant).toBe('warning');
    expect(toast?.message).toContain('fill in your details');
  });

  it('errors when a selected table is now booked, listing its number', () => {
    const toast = validateReservation({ ...base, bookedTableIds: ['a'] }, t);
    expect(toast?.variant).toBe('error');
    expect(toast?.message).toContain('1'); // tableNumber of t1
  });

  it('returns null for a fully valid reservation', () => {
    expect(validateReservation(base, t)).toBeNull();
  });

  it('leaves phone/special requests optional under the default rules (empty is fine)', () => {
    expect(validateReservation({ ...base, customerPhone: '', specialRequests: '' }, t)).toBeNull();
  });

  it('warns when a config-required phone is empty (mirrors the backend enforcement)', () => {
    const rules = { customerPhone: { isVisible: true, isRequired: true } };
    const toast = validateReservation(base, t, rules);
    expect(toast?.variant).toBe('warning');
    expect(toast?.message).toContain('fill in your details');
    expect(validateReservation({ ...base, customerPhone: '+41 22 000 00 00' }, t, rules)).toBeNull();
  });
});

describe('areRequiredReservationDetailsFilled', () => {
  const values = { customerName: 'Ada', customerEmail: 'ada@example.com', customerPhone: '', specialRequests: '' };

  it('passes under the default rules (locked name/email filled, the rest optional)', () => {
    expect(areRequiredReservationDetailsFilled(values)).toBe(true);
  });

  it('always requires the locked name/email — whitespace does not count', () => {
    expect(areRequiredReservationDetailsFilled({ ...values, customerName: '  ' })).toBe(false);
    expect(areRequiredReservationDetailsFilled({ ...values, customerEmail: '' })).toBe(false);
  });

  it('enforces config-required fields, falling back to defaults for missing rules', () => {
    const rules = { specialRequests: { isVisible: true, isRequired: true } };
    expect(areRequiredReservationDetailsFilled(values, rules)).toBe(false);
    expect(areRequiredReservationDetailsFilled({ ...values, specialRequests: 'window seat' }, rules)).toBe(true);
  });

  it('never enforces a hidden field, even if a corrupt config marks it required', () => {
    const rules = { customerPhone: { isVisible: false, isRequired: true } };
    expect(areRequiredReservationDetailsFilled(values, rules)).toBe(true);
  });
});

describe('buildSpecialRequests', () => {
  const base = {
    specialRequests: 'Birthday',
    capacityWarning: '',
    numberOfGuests: 4,
    selectedTableIds: ['a'],
    requestCombineTables: false,
    allTables: [t1, t2],
  };

  it('returns the plain note when there is nothing to annotate', () => {
    expect(buildSpecialRequests(base)).toBe('Birthday');
  });

  it('prepends a capacity-review annotation when warned', () => {
    const out = buildSpecialRequests({ ...base, capacityWarning: 'too big' });
    expect(out).toContain('CAPACITY REVIEW NEEDED');
    expect(out).toContain('Birthday');
  });

  it('prepends a combine-tables annotation for >1 selected table', () => {
    const out = buildSpecialRequests({ ...base, requestCombineTables: true, selectedTableIds: ['a', 'b'] });
    expect(out).toContain('REQUEST TO COMBINE TABLES: 1, 2');
  });

  it('does not add the combine annotation for a single table', () => {
    const out = buildSpecialRequests({ ...base, requestCombineTables: true, selectedTableIds: ['a'] });
    expect(out).not.toContain('COMBINE');
  });

  it('prepends both annotations, with combine landing first', () => {
    const out = buildSpecialRequests({
      ...base,
      capacityWarning: 'big party',
      requestCombineTables: true,
      selectedTableIds: ['a', 'b'],
    });
    // capacity is prepended first, then combine on top → combine appears before capacity.
    expect(out.indexOf('COMBINE')).toBeLessThan(out.indexOf('CAPACITY'));
  });

  it('handles an empty base note', () => {
    expect(buildSpecialRequests({ ...base, specialRequests: '' })).toBe('');
  });
});

describe('buildReservationPayload', () => {
  it('builds a 2-hour slot payload with trimmed phone and ISO date', () => {
    const dto = buildReservationPayload(
      'a',
      '2026-08-15',
      '19:00',
      3,
      { customerName: 'Ada', customerEmail: 'ada@example.com', customerPhone: ' +41 79 ' },
      'note',
    );
    expect(dto).toMatchObject({
      tableId: 'a',
      startTime: '19:00:00',
      endTime: '21:00:00',
      numberOfGuests: 3,
      customerPhone: '+41 79',
      specialRequests: 'note',
    });
    expect(dto.reservationDate).toBe('2026-08-15T00:00:00.000Z');
  });

  it('sends empty phone and null specialRequests when blank', () => {
    const dto = buildReservationPayload(
      'a',
      '2026-08-15',
      '18:00',
      2,
      { customerName: 'Ada', customerEmail: 'ada@example.com', customerPhone: '   ' },
      '',
    );
    expect(dto.customerPhone).toBe('');
    expect(dto.specialRequests).toBeNull();
  });

  it('rounds the end to the hour, dropping start-time minutes (2-hour slot)', () => {
    const dto = buildReservationPayload(
      'a',
      '2026-08-15',
      '19:30',
      2,
      { customerName: 'Ada', customerEmail: 'ada@example.com', customerPhone: '' },
      '',
    );
    expect(dto.startTime).toBe('19:30:00');
    expect(dto.endTime).toBe('21:00:00'); // parseInt('19') + 2 = 21; minutes are dropped
  });
});

/**
 * Every case here was rewritten. The old ones hand-built an **axios** error envelope
 * (`err.response.data.errors`) — a shape this app has never produced, because axios is not a
 * dependency — so the function was 100%-covered while its first two branches had never run once.
 * The third branch did run, which is why this was a quiet gap rather than a visible outage: what
 * it could not reach was `errors[]`. These use what `createReservation` actually throws.
 */
describe('extractReservationErrorMessage', () => {
  it('shows EVERY entry of the API errors array, not just the first', () => {
    // This asserted `'Table gone'` alone until frontend #490. It was lossless while a validator
    // failure was one `'; '`-joined blob; backend #291 splits it per rule, so keeping the old
    // assertion would have pinned "tell the guest one reason and drop the rest" as the contract.
    expect(extractReservationErrorMessage(new ApiError(400, 'Validation failed', ['Table gone', 'other']), t)).toBe(
      'Table gone; other',
    );
  });

  it('drops the generic wrapper but keeps every real reason beside it', () => {
    // `'Operation failed'` is filtered out — it is the backend's `ApiResponse.Failure` default and
    // says less than the translated fallback. The reasons around it must survive that filter.
    expect(
      extractReservationErrorMessage(
        new ApiError(400, 'Operation failed', ['Operation failed', 'Table gone', 'Party too large']),
        t,
      ),
    ).toBe('Table gone; Party too large');
  });

  it("shows the server's summary when there is no errors array", () => {
    expect(extractReservationErrorMessage(new ApiError(409, 'Slot already taken'), t)).toBe('Slot already taken');
  });

  it('reads the RESOLVED shape too, not only the thrown one', () => {
    // A genuine `{ success: false }` object, not an `ApiError` — `serverMessages` reads both, and
    // this reaches the function unwrapped on any path that does not go through a service.
    expect(extractReservationErrorMessage({ success: false, errors: ['Slot already taken'] }, t)).toBe(
      'Slot already taken',
    );
  });

  it('prefers the per-rule reason over the summary — the exact shape the backend sends', () => {
    // Not a hypothetical shape. `CreateReservationCommand` answers with the ONE-argument
    // `ApiResponse.Failure("<reason>")`, which puts the reason in `Errors[0]` and leaves `Message`
    // at its default literal `"Operation failed"`; `ReservationsController` returns
    // `BadRequest(result)`. So this is verbatim what a guest booking a taken table produces — and
    // what the old implementation printed for it was **"Operation failed"**.
    const asSent = new ApiError(400, 'Operation failed', ['Table 5 is not available for the selected time slot']);

    expect(extractReservationErrorMessage(asSent, t)).toBe('Table 5 is not available for the selected time slot');
  });

  it("skips the backend's generic wrapper in favour of the translated sentence", () => {
    // 'Operation failed' says less than the localised string it would replace.
    expect(extractReservationErrorMessage(new ApiError(400, 'Operation failed'), t)).toBe(
      'Failed to create reservation',
    );
  });

  it('falls back for a message-less ApiError — the backend-down case', () => {
    // The one #401 is about: `apiClient` no longer writes a sentence, so this genuinely has
    // nothing to say and the translated fallback is what shows.
    expect(extractReservationErrorMessage(new ApiError(0, ''), t)).toBe('Failed to create reservation');
    expect(extractReservationErrorMessage(new ApiError(500, '   '), t)).toBe('Failed to create reservation');
  });

  it('falls back for a client-side throw rather than rendering it', () => {
    expect(extractReservationErrorMessage(new TypeError('Failed to fetch'), t)).toBe('Failed to create reservation');
  });

  it('falls back to the default when nothing usable is present', () => {
    expect(extractReservationErrorMessage({}, t)).toBe('Failed to create reservation');
    expect(extractReservationErrorMessage(null, t)).toBe('Failed to create reservation');
  });
});

/**
 * The party-size check that the Capacity Notice hangs off. Its whole point is that it
 * takes nothing but the table list and the guest count — the old path reached the same
 * conclusion only through `computeTableAvailability`, which needs a chosen slot, so a
 * guest booking for 12 learned nothing until they had also picked a date and a time.
 * `useReservationAvailability.test.ts` pins that end of it; these are the boundaries.
 */
describe('partyExceedsEveryTable', () => {
  const tbl = (id: string, maxGuests: number) => ({ id, maxGuests }) as never;

  it('is true when no single table can seat the party', () => {
    expect(partyExceedsEveryTable([tbl('a', 4), tbl('b', 6)], 8)).toBe(true);
  });

  it('is false when one table is exactly big enough', () => {
    expect(partyExceedsEveryTable([tbl('a', 4), tbl('b', 8)], 8)).toBe(false);
  });

  it('is false before the table list has loaded, so no notice flashes on mount', () => {
    expect(partyExceedsEveryTable([], 8)).toBe(false);
  });

  it('reads the largest table, not the first or the last', () => {
    // A `>` against the wrong element still passes the two cases above, where the
    // biggest table happens to be last.
    expect(partyExceedsEveryTable([tbl('a', 10), tbl('b', 4)], 8)).toBe(false);
    expect(partyExceedsEveryTable([tbl('a', 4), tbl('b', 10), tbl('c', 4)], 8)).toBe(false);
  });
});

describe('isCustomerEditableReservation', () => {
  const booking = (status: ReservationStatus, reservationDate: string) => ({ status, reservationDate });

  it.each([
    [ReservationStatus.Pending, true],
    [ReservationStatus.Confirmed, true],
    [ReservationStatus.Cancelled, false],
    [ReservationStatus.Completed, false],
    [ReservationStatus.NoShow, false],
  ])('status %s → %s', (status, expected) => {
    expect(isCustomerEditableReservation(booking(status, '2026-10-24'), '2026-10-01')).toBe(expected);
  });

  it("refuses a booking whose day is behind the RESTAURANT's day", () => {
    expect(isCustomerEditableReservation(booking(ReservationStatus.Confirmed, '2026-09-30'), '2026-10-01')).toBe(false);
  });

  it('allows TODAY — the server, not the client, decides whether it is too late in the day', () => {
    expect(isCustomerEditableReservation(booking(ReservationStatus.Confirmed, '2026-10-01'), '2026-10-01')).toBe(true);
  });

  it('reads a wire value that carries a time part as the same day', () => {
    expect(
      isCustomerEditableReservation(booking(ReservationStatus.Confirmed, '2026-10-01T00:00:00Z'), '2026-10-01'),
    ).toBe(true);
  });

  it("answers false while the restaurant's day is still unknown, rather than guessing", () => {
    // `''` is `useTenantToday` before its first answer. A plain `>=` against it is TRUE for every
    // date string, so without the guard every past booking would offer an edit the server refuses.
    expect(isCustomerEditableReservation(booking(ReservationStatus.Confirmed, '2020-01-01'), '')).toBe(false);
  });
});

describe('getSelfServiceTimeSlotOptions', () => {
  it("offers a slot only while the booking's OWN table is free at it", () => {
    // The endpoint carries no tableId and never re-seats the party (contract §2.2), so another
    // free table at 13:00 is no use to a guest sitting at table `a`.
    const slots = [slot('12:00:00', [t1, t2]), slot('13:00:00', [t2, t3])];
    expect(getSelfServiceTimeSlotOptions(slots, 'a')).toEqual([
      { time: '12:00', available: true },
      { time: '13:00', available: false },
    ]);
  });

  it("keeps the booking's own current time offerable — its table is taken BY the booking", () => {
    const slots = [slot('19:30:00', [])];
    expect(getSelfServiceTimeSlotOptions(slots, 'a', '19:30')).toEqual([{ time: '19:30', available: true }]);
    // …and only for that time, not as a blanket pass.
    expect(getSelfServiceTimeSlotOptions(slots, 'a', '18:00')).toEqual([{ time: '19:30', available: false }]);
  });

  it('does not ask whether a PICKED table is free — this surface has no table picker', () => {
    // getTimeSlotOptions answers `true` for every slot when nothing is selected, even a fully
    // booked one; the self-service picker must not offer that.
    const slots = [slot('12:00:00', [])];
    expect(getTimeSlotOptions([], slots)).toEqual([{ time: '12:00', available: true }]);
    expect(getSelfServiceTimeSlotOptions(slots, 'a')).toEqual([{ time: '12:00', available: false }]);
  });
});

describe('resolveSlotEndTime', () => {
  it("takes the chosen slot's own end, normalised to HH:mm:ss", () => {
    expect(resolveSlotEndTime('19:30', [{ startTime: '19:30:00', endTime: '21:30:00', availableTables: [] }])).toBe(
      '21:30:00',
    );
  });

  it('falls back to the same two-hour sitting the booking page assumes', () => {
    expect(resolveSlotEndTime('19:30', [])).toBe('21:30:00');
  });

  it('pads and wraps rather than emitting an hour a TimeSpan cannot bind', () => {
    expect(resolveSlotEndTime('07:00', [])).toBe('09:00:00');
    expect(resolveSlotEndTime('23:00', [])).toBe('01:00:00');
  });

  it('tolerates a bare hour, rather than putting the string "undefined" on the wire', () => {
    expect(resolveSlotEndTime('20', [])).toBe('22:00:00');
  });
});

describe('buildMyReservationUpdatePayload', () => {
  const input = {
    customerName: '  Ada Lovelace ',
    customerEmail: ' ada@example.com ',
    customerPhone: '  ',
    specialRequests: '   ',
    reservationDate: '2026-10-24',
    startTime: '19:30',
    endTime: '21:30:00',
    numberOfGuests: 4,
  };

  it('is the exact self-update contract body — no status, no tableId', () => {
    expect(buildMyReservationUpdatePayload({ ...input, customerPhone: '+41 79 000 00 00' })).toEqual({
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.com',
      customerPhone: '+41 79 000 00 00',
      reservationDate: '2026-10-24T00:00:00Z',
      startTime: '19:30:00',
      endTime: '21:30:00',
      numberOfGuests: 4,
      specialRequests: null,
    });
  });

  it('sends LOCAL wall-clock times, never a UTC-converted instant', () => {
    // The mobile client sent `toISOString()` here: an ISO datetime does not bind to a TimeSpan at
    // all, and the UTC conversion moved the booking by the client's offset. Asserted from a zone
    // that is NOT UTC, where a `toISOString()` implementation would visibly disagree.
    const payload = buildMyReservationUpdatePayload(input);
    expect(payload.startTime).toBe('19:30:00');
    expect(payload.endTime).toBe('21:30:00');
    expect(payload.startTime).not.toContain('T');
    expect(payload.startTime).not.toContain('Z');
    expect(new Date(`${input.reservationDate}T${payload.startTime}Z`).toISOString()).not.toBe(payload.startTime);
  });

  it('trims, and sends a blank note as null / a blank phone as an empty string', () => {
    const payload = buildMyReservationUpdatePayload(input);
    expect(payload.customerName).toBe('Ada Lovelace');
    expect(payload.customerPhone).toBe('');
    expect(payload.specialRequests).toBeNull();
    expect(buildMyReservationUpdatePayload({ ...input, specialRequests: ' Birthday ' }).specialRequests).toBe(
      'Birthday',
    );
  });

  it('normalises a bare hour rather than shipping a half-formed TimeSpan', () => {
    const payload = buildMyReservationUpdatePayload({ ...input, startTime: '20', endTime: '22' });
    expect(payload.startTime).toBe('20:00:00');
    expect(payload.endTime).toBe('22:00:00');
  });

  it('sends UTC midnight in the exact shape the endpoint accepts — no milliseconds, no offset', () => {
    // The endpoint refuses any other time-of-day with a 400 rather than risk a silent day shift.
    expect(buildMyReservationUpdatePayload(input).reservationDate).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00Z$/);
  });

  it('carries the day the guest pressed, not one a Date in the device zone re-derived', () => {
    expect(buildMyReservationUpdatePayload({ ...input, reservationDate: '2026-01-01' }).reservationDate).toBe(
      '2026-01-01T00:00:00Z',
    );
  });
});

describe('serverReservationMessage', () => {
  it("returns the server's per-rule reasons, joined", () => {
    const error = new ApiError(400, 'Operation failed', ['The slot is no longer free', 'Party too large']);
    expect(serverReservationMessage(error, t)).toBe('The slot is no longer free; Party too large');
  });

  it("returns null when all the server said was its generic wrapper, so the caller's own sentence wins", () => {
    expect(serverReservationMessage(new ApiError(400, 'Operation failed'), t)).toBeNull();
    expect(serverReservationMessage(new Error('Failed to fetch'), t)).toBeNull();
  });
});

/**
 * The OTHER failure shape (frontend #557, contract §0.2). A `[Range]`, `[Required]` or
 * `[EmailAddress]` rule is enforced by MVC model validation BEFORE the handler runs, so the
 * refusal is `application/problem+json` and never the `ApiResponse` envelope every other case here
 * uses. `apiClient` now keeps its field keys (`fieldErrors`) beside the flattened messages, and
 * these are the errors it emits — `apiClientRequest.test.ts` pins that they are what `request()`
 * really produces, so building them here is mirroring, not inventing.
 */
describe('serverReservationMessage — problem+json refusals', () => {
  const problem = (fields: Record<string, string[]>) =>
    new ApiError(
      400,
      'One or more validation errors occurred.',
      Object.values(fields).flat(),
      undefined,
      undefined,
      fields,
    );

  it('answers an over-cap party in the guest`s own words, not with a C# property name', () => {
    // What the guest used to read: "The field NumberOfGuests must be between 1 and 20."
    expect(
      serverReservationMessage(problem({ NumberOfGuests: ['The field NumberOfGuests must be between 1 and 20.'] }), t),
    ).toBe('Please choose between 1 and 20 guests.');
  });

  it('answers a `"$"`-keyed refusal without leaking the .NET type name', () => {
    const blob =
      "JSON deserialization for type 'RestaurantSystem.Api.Features.Reservations.Dtos.UpdateMyReservationDto' was missing required properties including: 'endTime'.";

    expect(serverReservationMessage(problem({ $: [blob] }), t)).toBe(
      'Some booking details were missing. Please reload the page and try again.',
    );
  });

  it('translates a refused email address', () => {
    expect(
      serverReservationMessage(
        problem({ CustomerEmail: ['The CustomerEmail field is not a valid e-mail address.'] }),
        t,
      ),
    ).toBe('Please enter a valid email');
  });

  it('keeps the server`s own sentence for a field it has nothing better to say about', () => {
    // `CustomerName` carries [Required] AND [MaxLength(100)]: "Name is required" would be a lie
    // for the second, and telling them apart means matching English the contract calls unstable.
    expect(serverReservationMessage(problem({ CustomerName: ['The CustomerName field is required.'] }), t)).toBe(
      'The CustomerName field is required.',
    );
  });

  it('reports every refused field, not just the first', () => {
    expect(
      serverReservationMessage(
        problem({
          CustomerName: ['The CustomerName field is required.'],
          NumberOfGuests: ['The field NumberOfGuests must be between 1 and 20.'],
        }),
        t,
      ),
    ).toBe('The CustomerName field is required.; Please choose between 1 and 20 guests.');
  });

  it('reads a JSON-path key as the member it points at', () => {
    // A TYPE mismatch keys the failure `$.numberOfGuests`, not `NumberOfGuests`.
    expect(
      serverReservationMessage(
        problem({ '$.numberOfGuests': ['The JSON value could not be converted to System.Int32.'] }),
        t,
      ),
    ).toBe('Please choose between 1 and 20 guests.');
  });

  it('is what the create path shows too — one parser, both forms', () => {
    expect(
      extractReservationErrorMessage(
        problem({ NumberOfGuests: ['The field NumberOfGuests must be between 1 and 20.'] }),
        t,
      ),
    ).toBe('Please choose between 1 and 20 guests.');
  });
});
