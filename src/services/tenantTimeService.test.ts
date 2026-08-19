/**
 * @jest-environment ./jest-environments/timezone.js
 * @jest-environment-options {"timezone": "America/Los_Angeles"}
 */
import { getTenantToday, resetTenantTodayCache } from './tenantTimeService';
import { apiClient, ApiError } from '@/utils/apiClient';
import { trackEvent } from '@/lib/analytics';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/utils/apiClient', () => {
  const actual = jest.requireActual('@/utils/apiClient');
  return { ...actual, apiClient: { get: jest.fn() } };
});

const mockGet = apiClient.get as jest.Mock;
const mockTrack = trackEvent as jest.Mock;

/** A day close enough to now to be plausible, whatever day this suite runs on. */
const nearbyDay = (offsetDays = 0): string => {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + offsetDays);
  return day.toISOString().slice(0, 10);
};

beforeEach(() => {
  jest.clearAllMocks();
  resetTenantTodayCache();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('getTenantToday — the restaurant names its own day', () => {
  it('asks the right route and returns what it said', async () => {
    mockGet.mockResolvedValue({ success: true, data: { date: nearbyDay(), timeZone: 'Europe/Zurich' } });

    await expect(getTenantToday()).resolves.toEqual({ date: nearbyDay(), timeZone: 'Europe/Zurich' });
    expect(mockGet).toHaveBeenCalledWith('/api/tenant/today');
  });

  it('answers "unknown" rather than a day when the route is not there', async () => {
    // An older backend 404s this endpoint. Reading that as "today" would put the client straight
    // back to guessing, which is the defect (#517) — so the caller must be told nothing is known.
    mockGet.mockRejectedValue(new ApiError(404, 'Not Found'));

    await expect(getTenantToday()).resolves.toBeNull();
  });

  it.each([
    ['a day that does not exist', '2026-02-31'],
    ['an instant instead of a day', '2026-08-19T00:00:00Z'],
    ['an empty string', ''],
    ['a number', 20260819],
    ['nothing at all', undefined],
    // What a backend that cannot resolve its zone serialises: a well-formed day that no restaurant
    // is having. Rendered to a guest and sent back as `?date=`, it is worse than no answer.
    ['a default DateOnly', '0001-01-01'],
    ['the unix epoch', '1970-01-01'],
  ])('refuses %s', async (_case, date) => {
    mockGet.mockResolvedValue({ success: true, data: { date, timeZone: 'Europe/Zurich' } });

    await expect(getTenantToday()).resolves.toBeNull();
  });

  it("accepts a day either side of this device's own", async () => {
    // The device's clock is a guess too, so the plausibility window is wide: it is there to catch a
    // sentinel, not to second-guess the restaurant.
    mockGet.mockResolvedValue({ success: true, data: { date: nearbyDay(1), timeZone: 'Pacific/Kiritimati' } });
    await expect(getTenantToday()).resolves.toEqual({ date: nearbyDay(1), timeZone: 'Pacific/Kiritimati' });

    resetTenantTodayCache();
    mockGet.mockResolvedValue({ success: true, data: { date: nearbyDay(-1), timeZone: 'Pacific/Midway' } });
    await expect(getTenantToday()).resolves.toEqual({ date: nearbyDay(-1), timeZone: 'Pacific/Midway' });
  });

  it('survives a body with no data at all', async () => {
    mockGet.mockResolvedValue({ success: false });

    await expect(getTenantToday()).resolves.toBeNull();
  });
});

describe('getTenantToday — the callers are polls', () => {
  // Installed ONCE for the whole block: re-installing fake timers resets the clock to the real
  // "now", so a second `useFakeTimers()` silently rewinds a suite that is advancing it by hand.
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'queueMicrotask', 'nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-08-19T02:00:00Z'));
  });

  it('answers a second caller from the first answer', async () => {
    // The floor view refreshes its tables every 5 seconds. One request per refresh, to learn a
    // value that changes once a day, is the cost this cache exists to remove.
    mockGet.mockResolvedValue({ success: true, data: { date: nearbyDay(), timeZone: 'Europe/Zurich' } });

    await getTenantToday();
    await getTenantToday();
    await getTenantToday();

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('shares one request between callers that arrive together', async () => {
    let answer: (value: unknown) => void = () => {};
    mockGet.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const both = Promise.all([getTenantToday(), getTenantToday()]);
    answer({ success: true, data: { date: nearbyDay(), timeZone: 'Europe/Zurich' } });

    await both;
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('asks again once the answer is a minute old', async () => {
    mockGet.mockResolvedValue({ success: true, data: { date: '2026-08-19', timeZone: 'Europe/Zurich' } });

    await getTenantToday();
    expireCache();
    await getTenantToday();

    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('caches a failure too, and reports it once rather than once per poll', async () => {
    // `window.dataLayer` is a queue nothing drains, on a tablet that is never closed: an event per
    // failed poll is ~17k objects a day.
    mockGet.mockRejectedValue(new ApiError(503, 'gone'));

    await getTenantToday();
    expireCache();
    await getTenantToday();
    expireCache();
    await getTenantToday();

    expect(mockGet).toHaveBeenCalledTimes(3);
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('tenant_day_unavailable', { failureReason: 'unreachable' });
  });

  it('reports again when the outcome changes', async () => {
    mockGet.mockRejectedValue(new ApiError(503, 'gone'));
    await getTenantToday();
    expect(mockTrack).toHaveBeenCalledTimes(1);

    expireCache();
    mockGet.mockResolvedValue({ success: true, data: { date: nearbyDay(), timeZone: 'Europe/Zurich' } });
    await getTenantToday();

    expireCache();
    mockGet.mockResolvedValue({ success: true, data: { date: '0001-01-01', timeZone: '' } });
    await getTenantToday();

    expect(mockTrack).toHaveBeenCalledTimes(2);
    expect(mockTrack).toHaveBeenLastCalledWith('tenant_day_unavailable', { failureReason: 'unreadable' });
  });

  it('says nothing when the restaurant answered', async () => {
    mockGet.mockResolvedValue({ success: true, data: { date: nearbyDay(), timeZone: 'Europe/Zurich' } });

    await getTenantToday();

    expect(mockTrack).not.toHaveBeenCalled();
  });
});

/**
 * Expires the cached answer WITHOUT forgetting the last reported outcome — which is what the
 * passage of a minute does in production, and what `resetTenantTodayCache()` deliberately does not.
 */
function expireCache(): void {
  jest.setSystemTime(Date.now() + 61_000);
}
