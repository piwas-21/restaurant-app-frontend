/**
 * @jest-environment ./jest-environments/timezone.js
 * @jest-environment-options {"timezone": "America/Los_Angeles"}
 */
import { getTenantToday } from './tenantTimeService';
import { apiClient, ApiError } from '@/utils/apiClient';
import { trackEvent } from '@/lib/analytics';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/utils/apiClient', () => {
  const actual = jest.requireActual('@/utils/apiClient');
  return { ...actual, apiClient: { get: jest.fn() } };
});

const mockGet = apiClient.get as jest.Mock;
const mockTrack = trackEvent as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('getTenantToday — the restaurant names its own day', () => {
  it('asks the right route and returns what it said', async () => {
    mockGet.mockResolvedValue({ success: true, data: { date: '2026-08-19', timeZone: 'Europe/Zurich' } });

    await expect(getTenantToday()).resolves.toEqual({ date: '2026-08-19', timeZone: 'Europe/Zurich' });
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
  ])('refuses %s', async (_case, date) => {
    // Whatever comes back here is handed to the API as a `date` parameter and shown to a guest as
    // the day they are booking, so a value this client cannot read is not a day.
    mockGet.mockResolvedValue({ success: true, data: { date, timeZone: 'Europe/Zurich' } });

    await expect(getTenantToday()).resolves.toBeNull();
  });

  it('survives a body with no data at all', async () => {
    mockGet.mockResolvedValue({ success: false });

    await expect(getTenantToday()).resolves.toBeNull();
  });

  it('makes the fallback observable, because nothing else would be', async () => {
    // The fallback silently decides which day a table is booked for whenever the guest's zone
    // differs from the venue's. A console warning on a guest's phone is observable by nobody.
    mockGet.mockRejectedValue(new ApiError(503, 'gone'));
    await getTenantToday();
    expect(mockTrack).toHaveBeenCalledWith('tenant_day_unavailable', { failureReason: 'unreachable' });

    mockTrack.mockClear();
    mockGet.mockResolvedValue({ success: true, data: { date: 'nonsense', timeZone: 'Europe/Zurich' } });
    await getTenantToday();
    expect(mockTrack).toHaveBeenCalledWith('tenant_day_unavailable', { failureReason: 'unreadable' });
  });

  it('says nothing when the restaurant answered', async () => {
    mockGet.mockResolvedValue({ success: true, data: { date: '2026-08-19', timeZone: 'Europe/Zurich' } });

    await getTenantToday();

    expect(mockTrack).not.toHaveBeenCalled();
  });
});
