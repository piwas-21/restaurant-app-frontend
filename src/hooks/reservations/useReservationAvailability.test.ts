import { act, renderHook, waitFor } from '@testing-library/react';
import { useReservationAvailability } from './useReservationAvailability';
import { reservationService } from '@/services/reservationService';

jest.mock('@/services/reservationService', () => ({
  reservationService: { getTables: jest.fn(), getAvailableTimeSlots: jest.fn() },
}));
jest.mock('notistack', () => ({ enqueueSnackbar: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, vars?: Record<string, unknown>) =>
      Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, String(v)), fallback),
    i18n: { language: 'en' },
  }),
}));

const mocked = reservationService as jest.Mocked<typeof reservationService>;
const table = (id: string, maxGuests: number) => ({ id, maxGuests, tableNumber: id, isActive: true }) as never;

beforeEach(() => {
  jest.clearAllMocks();
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
