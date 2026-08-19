/**
 * @jest-environment ./jest-environments/timezone.js
 * @jest-environment-options {"timezone": "America/Los_Angeles"}
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTenantToday } from './useTenantToday';
import { getTenantToday } from '@/services/tenantTimeService';
import { todayOnDevice } from '@/utils/calendarDay';

jest.mock('@/services/tenantTimeService', () => ({ getTenantToday: jest.fn() }));

const mockGetTenantToday = getTenantToday as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('useTenantToday', () => {
  it('knows nothing until the restaurant has answered', async () => {
    let answer: (value: { date: string; timeZone: string } | null) => void = () => {};
    mockGetTenantToday.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const { result } = renderHook(() => useTenantToday());

    // The date picker renders from this, so "unknown" must be distinguishable from a day — an
    // initial guess would be shown to a guest and then silently replaced.
    expect(result.current).toEqual({ today: '', source: 'unknown' });

    answer({ date: '2026-08-19', timeZone: 'Europe/Zurich' });
    await waitFor(() => expect(result.current).toEqual({ today: '2026-08-19', source: 'tenant' }));
  });

  it("falls back to the device's LOCAL day, and says that is what it did", async () => {
    // An older backend or a network blip must not leave the booking form with no dates. The
    // fallback is the local day — never `toISOString()`'s UTC one, which is a different day for
    // part of every night and is the defect itself.
    //
    // The clock is pinned at an instant where those two disagree ON THIS DEVICE (19:00 on the 18th
    // in Los Angeles is already the 19th in UTC); at an arbitrary run time they agree for most of
    // the day and the second assertion below would pass against the bug.
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'queueMicrotask', 'nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-08-19T02:00:00Z'));
    mockGetTenantToday.mockResolvedValue(null);

    try {
      const { result } = renderHook(() => useTenantToday());

      await waitFor(() => expect(result.current.source).toBe('device'));
      expect(result.current.today).toBe('2026-08-18');
      expect(result.current.today).toBe(todayOnDevice());
      expect(new Date().toISOString().split('T')[0]).toBe('2026-08-19');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not write state after the component is gone', async () => {
    let answer: (value: { date: string; timeZone: string } | null) => void = () => {};
    mockGetTenantToday.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(() => useTenantToday());
    unmount();
    answer({ date: '2026-08-19', timeZone: 'Europe/Zurich' });
    await Promise.resolve();

    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe('useTenantToday — a page left open must not keep yesterday', () => {
  afterEach(() => jest.useRealTimers());

  it('re-asks when the page becomes visible again', async () => {
    mockGetTenantToday.mockResolvedValue({ date: '2026-08-19', timeZone: 'Europe/Zurich' });
    const { result } = renderHook(() => useTenantToday());
    await waitFor(() => expect(result.current.today).toBe('2026-08-19'));

    // A floor tablet that has been asleep since before the venue's midnight.
    mockGetTenantToday.mockResolvedValue({ date: '2026-08-20', timeZone: 'Europe/Zurich' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(result.current.today).toBe('2026-08-20'));
  });

  it('re-asks on a timer while it stays open', async () => {
    jest.useFakeTimers();
    mockGetTenantToday.mockResolvedValue({ date: '2026-08-19', timeZone: 'Europe/Zurich' });
    const { result } = renderHook(() => useTenantToday());
    await act(async () => {});
    expect(result.current.today).toBe('2026-08-19');

    mockGetTenantToday.mockResolvedValue({ date: '2026-08-20', timeZone: 'Europe/Zurich' });
    await act(async () => {
      jest.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(result.current.today).toBe('2026-08-20');
  });

  it('stops asking once the page is gone', async () => {
    jest.useFakeTimers();
    mockGetTenantToday.mockResolvedValue({ date: '2026-08-19', timeZone: 'Europe/Zurich' });
    const { unmount } = renderHook(() => useTenantToday());
    await act(async () => {});
    const callsWhileMounted = mockGetTenantToday.mock.calls.length;

    unmount();
    await act(async () => {
      jest.advanceTimersByTime(60 * 60 * 1000);
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockGetTenantToday.mock.calls).toHaveLength(callsWhileMounted);
  });

  it('does not ask when the page is going AWAY rather than coming back', async () => {
    mockGetTenantToday.mockResolvedValue({ date: '2026-08-19', timeZone: 'Europe/Zurich' });
    const { result } = renderHook(() => useTenantToday());
    await waitFor(() => expect(result.current.today).toBe('2026-08-19'));
    const asked = mockGetTenantToday.mock.calls.length;

    const visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockGetTenantToday.mock.calls).toHaveLength(asked);
    visibility.mockRestore();
  });

  it('hands back the SAME state when the day has not changed', async () => {
    // This runs on a timer. A fresh object every ten minutes would re-render the date picker, and
    // everything below it, for no change at all.
    jest.useFakeTimers();
    mockGetTenantToday.mockResolvedValue({ date: '2026-08-19', timeZone: 'Europe/Zurich' });
    const { result } = renderHook(() => useTenantToday());
    await act(async () => {});
    const first = result.current;

    await act(async () => {
      jest.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(result.current).toBe(first);
  });
});
