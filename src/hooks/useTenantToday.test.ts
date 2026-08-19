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
const zurich = (date: string) => ({ date, timeZone: 'Europe/Zurich' });

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.useRealTimers());

describe('useTenantToday', () => {
  it('knows nothing until the restaurant has answered', async () => {
    let answer: (value: { date: string; timeZone: string } | null) => void = () => {};
    mockGetTenantToday.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const { result } = renderHook(() => useTenantToday());

    // The date picker renders from this, so "unknown" must be distinguishable from a day — an
    // initial guess would be shown to a guest and then silently replaced.
    expect(result.current).toBe('');

    answer(zurich('2026-08-19'));
    await waitFor(() => expect(result.current).toBe('2026-08-19'));
  });

  it("falls back to the device's LOCAL day when nothing is known", async () => {
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

    const { result } = renderHook(() => useTenantToday());

    await waitFor(() => expect(result.current).toBe('2026-08-18'));
    expect(result.current).toBe(todayOnDevice());
    expect(new Date().toISOString().split('T')[0]).toBe('2026-08-19');
  });

  it('does not write the day in after the component is gone', async () => {
    let answer: (value: { date: string; timeZone: string } | null) => void = () => {};
    mockGetTenantToday.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const { result, unmount } = renderHook(() => useTenantToday());
    unmount();
    await act(async () => {
      answer(zurich('2026-08-19'));
    });

    // Asserting the STATE, not the absence of a console warning: React 19 removed the
    // "update on an unmounted component" message, so a console assertion here is green against a
    // hook with no unmount guard at all.
    expect(result.current).toBe('');
  });
});

describe('useTenantToday — a page left open must not keep yesterday', () => {
  it('re-asks when the page becomes visible again', async () => {
    mockGetTenantToday.mockResolvedValue(zurich('2026-08-19'));
    const { result } = renderHook(() => useTenantToday());
    await waitFor(() => expect(result.current).toBe('2026-08-19'));

    // A floor tablet that has been asleep since before the venue's midnight.
    mockGetTenantToday.mockResolvedValue(zurich('2026-08-20'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(result.current).toBe('2026-08-20'));
  });

  it('re-asks on a timer while it stays open', async () => {
    jest.useFakeTimers();
    mockGetTenantToday.mockResolvedValue(zurich('2026-08-19'));
    const { result } = renderHook(() => useTenantToday());
    await act(async () => {});
    expect(result.current).toBe('2026-08-19');

    mockGetTenantToday.mockResolvedValue(zurich('2026-08-20'));
    await act(async () => {
      jest.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(result.current).toBe('2026-08-20');
  });

  it('stops asking once the page is gone', async () => {
    jest.useFakeTimers();
    mockGetTenantToday.mockResolvedValue(zurich('2026-08-19'));
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
    mockGetTenantToday.mockResolvedValue(zurich('2026-08-19'));
    const { result } = renderHook(() => useTenantToday());
    await waitFor(() => expect(result.current).toBe('2026-08-19'));
    const asked = mockGetTenantToday.mock.calls.length;

    const visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockGetTenantToday.mock.calls).toHaveLength(asked);
    visibility.mockRestore();
  });
});

describe('useTenantToday — what a late or failed answer may NOT do', () => {
  it('ignores an answer that a newer request has already overtaken', async () => {
    // `visibilitychange` and the timer can put two in flight. The loser landing last would restore
    // yesterday for up to ten minutes — at exactly the rollover this hook exists to handle.
    let answerFirst: (value: { date: string; timeZone: string } | null) => void = () => {};
    mockGetTenantToday.mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)));
    const { result } = renderHook(() => useTenantToday());

    mockGetTenantToday.mockResolvedValue(zurich('2026-08-20'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(result.current).toBe('2026-08-20'));

    await act(async () => {
      answerFirst(zurich('2026-08-19'));
    });

    expect(result.current).toBe('2026-08-20');
  });

  it('keeps the day the restaurant named when a later ask fails', async () => {
    // One 503 on the ten-minute poll must not re-label all 14 buttons with this device's guess
    // under a guest who is mid-form. Falling back is for when nothing is known, not for forgetting.
    jest.useFakeTimers();
    mockGetTenantToday.mockResolvedValue(zurich('2026-08-19'));
    const { result } = renderHook(() => useTenantToday());
    await act(async () => {});
    expect(result.current).toBe('2026-08-19');

    mockGetTenantToday.mockResolvedValue(null);
    await act(async () => {
      jest.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(result.current).toBe('2026-08-19');
  });
});
