/**
 * @jest-environment ./jest-environments/timezone.js
 * @jest-environment-options {"timezone": "Europe/Zurich"}
 */
import { getUpcomingReservations } from './tables';
import { apiClient } from '@/utils/apiClient';
import { getTenantToday } from '@/services/tenantTimeService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/services/tenantTimeService', () => ({ getTenantToday: jest.fn() }));

const mockGet = apiClient.get as jest.Mock;
const mockTenantToday = getTenantToday as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Pinned away from every day these tests name, so a fallback to the device's clock cannot
  // accidentally agree with the restaurant's answer on the day this suite happens to run.
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'queueMicrotask', 'nextTick', 'setImmediate'] });
  jest.setSystemTime(new Date('2026-03-01T12:00:00Z'));
  mockGet.mockResolvedValue({
    success: true,
    data: { items: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 },
  });
});

afterEach(() => jest.useRealTimers());

const requestedDate = () => new URL(`https://x${mockGet.mock.calls[0][0]}`).searchParams.get('date');

describe("the floor view asks for the RESTAURANT's day (#517)", () => {
  it('uses the day the restaurant names', async () => {
    mockTenantToday.mockResolvedValue({ date: '2026-08-19', timeZone: 'Europe/Zurich' });

    await getUpcomingReservations();

    expect(requestedDate()).toBe('2026-08-19');
  });

  it('does not ask twice when the caller already knows the day', async () => {
    await getUpcomingReservations('2026-03-01');

    expect(requestedDate()).toBe('2026-03-01');
    expect(mockTenantToday).not.toHaveBeenCalled();
  });

  it('falls back to the device LOCAL day, not its UTC day', async () => {
    // 00:30 on the 19th in Zurich is still the 18th in UTC. The expression this replaces asked for
    // the 18th — yesterday's bookings against tonight's tables, on a correctly-set device.
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'queueMicrotask', 'nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-08-18T22:30:00Z'));
    mockTenantToday.mockResolvedValue(null);

    await getUpcomingReservations();

    expect(requestedDate()).toBe('2026-08-19');
    expect(new Date().toISOString().split('T')[0]).toBe('2026-08-18');
  });

  it('still asks only for CONFIRMED reservations', async () => {
    mockTenantToday.mockResolvedValue({ date: '2026-08-19', timeZone: 'Europe/Zurich' });

    await getUpcomingReservations();

    expect(mockGet.mock.calls[0][0]).toContain('status=1');
  });
});
