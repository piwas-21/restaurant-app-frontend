import { act, renderHook, waitFor } from '@testing-library/react';
import { enqueueSnackbar } from 'notistack';
import { useReservationAvailability } from './useReservationAvailability';
import { reservationService } from '@/services/reservationService';
import { ApiError } from '@/utils/apiClient';

jest.mock('@/services/reservationService', () => ({
  reservationService: { getTables: jest.fn(), getAvailableTimeSlots: jest.fn() },
}));
jest.mock('notistack', () => ({ enqueueSnackbar: jest.fn() }));
// The day the RESTAURANT is on. Mocked, or this hook reaches for the network in every test in this
// file — 22 console warnings and an un-`act`ed setState landing after the assertions.
jest.mock('@/hooks/useTenantToday', () => ({ useTenantToday: () => mockTenantToday() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, vars?: Record<string, unknown>) =>
      Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, String(v)), fallback),
    i18n: { language: 'en' },
  }),
}));

const mockTenantToday = jest.fn<string, []>(() => '2026-08-01');
const mocked = reservationService as jest.Mocked<typeof reservationService>;
const toast = enqueueSnackbar as jest.Mock;
const table = (id: string, maxGuests: number) => ({ id, maxGuests, tableNumber: id, isActive: true }) as never;

/** Drive the availability effect: tables loaded, then a date chosen. */
async function pickADate(result: { current: { setSelectedDate: (d: string) => void } }) {
  await waitFor(() => expect(mocked.getTables).toHaveBeenCalled());
  await act(async () => {
    result.current.setSelectedDate('2026-08-10');
  });
  await waitFor(() => expect(mocked.getAvailableTimeSlots).toHaveBeenCalled());
}

beforeEach(() => {
  jest.clearAllMocks();
  // `clearAllMocks` clears CALLS, not implementations: without this, a `mockReturnValue` from one
  // test is still in force in the next one.
  mockTenantToday.mockReturnValue('2026-08-01');
  mocked.getTables.mockResolvedValue([table('a', 4), table('b', 6)]);
  mocked.getAvailableTimeSlots.mockResolvedValue({ data: { timeSlots: [] } } as never);
});

/**
 * The behaviour these pin is a *timing* one: the capacity notice must appear as soon
 * as the party exceeds every table, with no date and no time chosen. It used to be
 * computed only inside the availability path, so it needed both.
 */
describe('useReservationAvailability — capacity notice timing', () => {
  it('warns as soon as the guest count exceeds every table, with NO date or time', async () => {
    const { result } = renderHook(() => useReservationAvailability());
    await waitFor(() => expect(result.current.allTables).toHaveLength(2));

    act(() => result.current.setNumberOfGuests(10));

    expect(result.current.capacityWarning).toContain('10 guests');
    // The point of the fix: no date, no time, no availability request needed.
    expect(result.current.selectedDate).toBe('');
    expect(result.current.selectedTime).toBe('');
    expect(mocked.getAvailableTimeSlots).not.toHaveBeenCalled();
  });

  it('stays quiet while one table can still seat the party', async () => {
    const { result } = renderHook(() => useReservationAvailability());
    await waitFor(() => expect(result.current.allTables).toHaveLength(2));

    act(() => result.current.setNumberOfGuests(6)); // table 'b' fits exactly
    expect(result.current.capacityWarning).toBe('');
  });

  it('clears itself when the guest count comes back down', async () => {
    const { result } = renderHook(() => useReservationAvailability());
    await waitFor(() => expect(result.current.allTables).toHaveLength(2));

    act(() => result.current.setNumberOfGuests(12));
    expect(result.current.capacityWarning).not.toBe('');
    act(() => result.current.setNumberOfGuests(2));
    expect(result.current.capacityWarning).toBe('');
  });

  it('shows nothing before the table list has loaded', () => {
    const { result } = renderHook(() => useReservationAvailability());
    act(() => result.current.setNumberOfGuests(99));
    // No tables known yet ⇒ no claim about capacity; a notice here would be a guess.
    expect(result.current.capacityWarning).toBe('');
  });

  it('survives a date change — the notice is about the party, not the day', async () => {
    const { result } = renderHook(() => useReservationAvailability());
    await waitFor(() => expect(result.current.allTables).toHaveLength(2));

    act(() => result.current.setNumberOfGuests(10));
    expect(result.current.capacityWarning).not.toBe('');

    act(() => result.current.setSelectedDate('2026-08-01'));
    await waitFor(() => expect(mocked.getAvailableTimeSlots).toHaveBeenCalled());
    // The old code blanked the warning at the top of every slot fetch.
    expect(result.current.capacityWarning).toContain('10 guests');
  });
});

/**
 * The failure paths, which used to empty the time dropdown and say nothing.
 *
 * An empty list is the app's way of saying "the restaurant is closed that day" — it already
 * toasts exactly that when the server returns zero slots. So a *failed* fetch that also emptied
 * the list did not read as a failure at all; it read as a closed Tuesday. Both shapes reach it:
 * the resolved `{ data: null }` refusal and a thrown `ApiError` from a non-2xx.
 */
describe('useReservationAvailability — a failed slot fetch is not a closed day', () => {
  it("shows the server's own reason when it refuses inside a 200", async () => {
    // `available-slots` ends `return Ok(await _mediator.SendQuery(…))` with no `Success` test, so
    // every one of the handler's three `Failure` answers is a 200 carrying `{success:false}` —
    // this branch is the live path, not a defensive one.
    mocked.getAvailableTimeSlots.mockResolvedValue({ data: null, error: 'No active tables found' } as never);

    const { result } = renderHook(() => useReservationAvailability());
    await pickADate(result);

    expect(toast).toHaveBeenCalledWith('No active tables found', { variant: 'error', preventDuplicate: true });
  });

  it('passes preventDuplicate on EVERY slot-failure toast, however many the keystrokes fire', async () => {
    // What this can and cannot prove: notistack is mocked here, so the de-duplication itself is
    // NOT exercised — that behaviour belongs to the library (v3 compares `item.message` when no
    // `key` is given). What it pins is that we ask for it on every one of these calls, which is
    // the part we own. The custom guest field is an `<input type="number">` whose onChange runs
    // per keystroke and the fetch effect depends on `numberOfGuests`, so typing "12" is two
    // fetches; without the option a backend outage stacks one snackbar per digit.
    //
    // The count assertion is load-bearing: `[].every(…)` is `true`, so shape-only would pass
    // against a version that enqueued nothing at all.
    mocked.getAvailableTimeSlots.mockResolvedValue({ data: null } as never);

    const { result } = renderHook(() => useReservationAvailability());
    await pickADate(result);
    await act(async () => {
      result.current.setNumberOfGuests(1);
    });
    await act(async () => {
      result.current.setNumberOfGuests(12);
    });

    expect(toast.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(toast.mock.calls.every(([, options]) => options.preventDuplicate === true)).toBe(true);
  });

  it('falls back to a TRANSLATED sentence when the server authored none', async () => {
    // `error: undefined` is the shape `reservationService` now returns for a refusal it could not
    // quote — the client-authored English literal that used to fill this slot is gone.
    mocked.getAvailableTimeSlots.mockResolvedValue({ data: null } as never);

    const { result } = renderHook(() => useReservationAvailability());
    await pickADate(result);

    expect(toast).toHaveBeenCalledWith('Failed to load available times', {
      variant: 'error',
      preventDuplicate: true,
    });
  });

  it("surfaces a thrown ApiError's errors[] rather than discarding it", async () => {
    mocked.getAvailableTimeSlots.mockRejectedValue(new ApiError(503, 'Service Unavailable', ['Reservations are down']));

    const { result } = renderHook(() => useReservationAvailability());
    await pickADate(result);

    expect(toast).toHaveBeenCalledWith('Reservations are down', { variant: 'error', preventDuplicate: true });
    expect(result.current.loading).toBe(false);
  });

  it('does NOT show the raw throw when the network is dead', async () => {
    // A `TypeError` is client-authored; putting `Failed to fetch` in a snackbar is worse than the
    // generic this whole sweep set out to replace. `getErrorMessage` returns null for it.
    mocked.getAvailableTimeSlots.mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useReservationAvailability());
    await pickADate(result);

    expect(toast).toHaveBeenCalledWith('Failed to load available times', {
      variant: 'error',
      preventDuplicate: true,
    });
  });

  it("surfaces the server's reason when the table list cannot load", async () => {
    mocked.getTables.mockRejectedValue(new ApiError(500, '', ['Tables are unavailable']));

    renderHook(() => useReservationAvailability());

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Tables are unavailable', { variant: 'error' }));
  });
});

describe("useReservationAvailability — the venue's day moving under a chosen date", () => {
  it("publishes the restaurant's day for the date strip", async () => {
    const { result } = renderHook(() => useReservationAvailability());

    await waitFor(() => expect(result.current.today).toBe('2026-08-01'));
  });

  it("drops a selected day once it is behind the restaurant's", async () => {
    // Midnight at the venue, on a page that has been open across it. `min` does not constrain a
    // value the strip put into React state, and `canSubmit` only checks that a date is set — so the
    // form would post yesterday, which the server refuses as past.
    // A day with slots, or the "restaurant closed" path clears the date for its own reasons.
    mocked.getAvailableTimeSlots.mockResolvedValue({
      data: { timeSlots: [{ startTime: '18:00:00', isAvailable: true }] },
    } as never);
    const { result, rerender } = renderHook(() => useReservationAvailability());
    await pickADate(result);
    expect(result.current.selectedDate).toBe('2026-08-10');

    mockTenantToday.mockReturnValue('2026-08-11');
    await act(async () => {
      rerender();
    });

    expect(result.current.selectedDate).toBe('');
  });

  it('leaves today itself alone', async () => {
    mocked.getAvailableTimeSlots.mockResolvedValue({
      data: { timeSlots: [{ startTime: '18:00:00', isAvailable: true }] },
    } as never);
    const { result, rerender } = renderHook(() => useReservationAvailability());
    await pickADate(result);

    mockTenantToday.mockReturnValue('2026-08-10');
    await act(async () => {
      rerender();
    });

    expect(result.current.selectedDate).toBe('2026-08-10');
  });
});
