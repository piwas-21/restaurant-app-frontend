import type { TableDto } from '@/types/reservation';
import { RESERVATION_GUEST_CAP, maxGuestsForBooking, maxGuestsForTable } from './reservationLimits';

/** Only `maxGuests` and `id` matter here; the rest of TableDto is scenery. */
function table(maxGuests: number, id = 't1'): TableDto {
  return {
    id,
    tableNumber: `T-${id}`,
    maxGuests,
    isActive: true,
  } as unknown as TableDto;
}

describe('maxGuestsForBooking — the booking page picker`s ceiling', () => {
  it('is the DTO cap when the table list has not loaded yet', () => {
    // One render per visit has an empty list. Offering 1 guest there would be worse than the
    // server refusing an over-sized party.
    expect(maxGuestsForBooking([])).toBe(RESERVATION_GUEST_CAP);
  });

  it('sums the tables, because the page lets a guest combine several', () => {
    expect(maxGuestsForBooking([table(2, 'a'), table(4, 'b')])).toBe(6);
  });

  it('never exceeds the backend`s [Range(1, 20)], however many seats the venue has', () => {
    expect(maxGuestsForBooking([table(10, 'a'), table(10, 'b'), table(10, 'c')])).toBe(RESERVATION_GUEST_CAP);
  });

  it('mirrors the backend cap exactly — 21 would be a 400 from model validation', () => {
    expect(RESERVATION_GUEST_CAP).toBe(20);
  });
});

describe('maxGuestsForTable — the edit modal`s ceiling', () => {
  it('is the booking`s own table, which the server never re-seats', () => {
    expect(maxGuestsForTable(table(4))).toBe(4);
  });

  it('falls back to the DTO cap for a table the list does not carry', () => {
    expect(maxGuestsForTable(undefined)).toBe(RESERVATION_GUEST_CAP);
  });

  it('caps a table larger than the DTO range allows', () => {
    // `CreateTableDto` carries `[Range(1, 20)]` on MaxGuests too, so this is defence in depth
    // rather than a live case — but a picker must never offer a party the reservation DTO refuses.
    expect(maxGuestsForTable(table(40))).toBe(RESERVATION_GUEST_CAP);
  });

  it('falls back rather than offering zero guests for a nonsense capacity', () => {
    expect(maxGuestsForTable(table(0))).toBe(RESERVATION_GUEST_CAP);
  });

  it('falls back when the capacity is not a finite number', () => {
    // `maxGuests` is typed `number`, and nothing checks that at runtime — an `undefined` on the
    // wire makes the sum NaN. `NaN < 1` is FALSE, so without the finite guard the picker would
    // render `max={NaN}`: an input that accepts anything, which is the bug this file exists for.
    expect(maxGuestsForTable(table(undefined as unknown as number))).toBe(RESERVATION_GUEST_CAP);
    expect(maxGuestsForBooking([table(undefined as unknown as number, 'a')])).toBe(RESERVATION_GUEST_CAP);
  });
});
