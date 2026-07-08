import type { TFunction } from 'i18next';
import type { TableDto, TimeSlotDto } from '@/types/reservation';
import {
  getCapacityWarningMessage,
  computeTableAvailability,
  getBookedTableToast,
  getFilteredTimeSlots,
  validateReservation,
  buildSpecialRequests,
  buildReservationPayload,
  extractReservationErrorMessage,
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
  width: 1,
  height: 1,
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

describe('getBookedTableToast', () => {
  const slots = [slot('12:00:00', [t1]), slot('13:00:00', [t2])];

  it('lists the HH:mm times a booked table is actually free (info)', () => {
    const toast = getBookedTableToast(t1, '2026-08-15', slots, 2, t);
    expect(toast.variant).toBe('info');
    expect(toast.autoHideDuration).toBe(5000);
    expect(toast.message).toContain('12:00');
  });

  it('says not-available-today (warning) when the table is free in no slot', () => {
    const toast = getBookedTableToast(t3, '2026-08-15', slots, 2, t);
    expect(toast.variant).toBe('warning');
    expect(toast.message).toContain('not available today');
  });

  it('falls back to currently-booked (warning) with no date or slots', () => {
    const toast = getBookedTableToast(t1, '', [], 2, t);
    expect(toast.variant).toBe('warning');
    expect(toast.message).toContain('currently booked');
  });
});

describe('getFilteredTimeSlots', () => {
  const slots = [slot('12:00:00', [t1, t2]), slot('13:00:00', [t2])];

  it('returns every slot as HH:mm when no tables are selected', () => {
    expect(getFilteredTimeSlots([], slots)).toEqual(['12:00', '13:00']);
  });

  it('keeps only slots where ALL selected tables are free', () => {
    expect(getFilteredTimeSlots(['a', 'b'], slots)).toEqual(['12:00']); // t1 only free at 12:00
    expect(getFilteredTimeSlots(['b'], slots)).toEqual(['12:00', '13:00']);
  });
});

describe('validateReservation', () => {
  const base = {
    selectedTableIds: ['a'],
    selectedDate: '2026-08-15',
    selectedTime: '12:00',
    customerName: 'Ada',
    customerEmail: 'ada@example.com',
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

describe('extractReservationErrorMessage', () => {
  it('prefers the first entry of the API errors array', () => {
    const err = { response: { data: { errors: ['Table gone', 'other'] } } };
    expect(extractReservationErrorMessage(err, t)).toBe('Table gone');
  });

  it('uses the API message when there is no errors array', () => {
    const err = { response: { data: { message: 'Slot already taken' } } };
    expect(extractReservationErrorMessage(err, t)).toBe('Slot already taken');
  });

  it('falls through an empty errors array to the API message', () => {
    // Exercises the `errors.length > 0` false path (the reason for the length guard).
    const err = { response: { data: { errors: [], message: 'Slot already taken' } } };
    expect(extractReservationErrorMessage(err, t)).toBe('Slot already taken');
  });

  it('ignores the generic "Operation failed" API message and falls through', () => {
    const err = { response: { data: { message: 'Operation failed' } }, message: 'Network down' };
    expect(extractReservationErrorMessage(err, t)).toBe('Network down');
  });

  it('ignores the generic axios 400 message', () => {
    const err = { message: 'Request failed with status code 400' };
    expect(extractReservationErrorMessage(err, t)).toBe('Failed to create reservation');
  });

  it('falls back to the default when nothing usable is present', () => {
    expect(extractReservationErrorMessage({}, t)).toBe('Failed to create reservation');
  });
});
