import { resolveDineInSession } from './newSaleSession';
import { getActiveTableServiceSessions } from '@/services/tableServiceSessionService';

jest.mock('@/services/tableServiceSessionService', () => ({
  getActiveTableServiceSessions: jest.fn(),
}));

const mockSessions = getActiveTableServiceSessions as jest.Mock;

const session = (overrides: Record<string, unknown> = {}) => ({
  serviceSessionId: 'session-1',
  tableId: 'table-12',
  tableNumber: 12,
  tableLabel: '12',
  status: 'Open',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resolveDineInSession', () => {
  it('refuses an empty label without fetching visits', async () => {
    await expect(resolveDineInSession({ label: '  ' })).resolves.toBeNull();
    expect(mockSessions).not.toHaveBeenCalled();
  });
  it('returns the open visit matching the table number', async () => {
    mockSessions.mockResolvedValueOnce([session({ tableNumber: 7 }), session()]);

    await expect(resolveDineInSession({ label: '12' })).resolves.toEqual({
      tableId: 'table-12',
      tableNumber: 12,
      serviceSessionId: 'session-1',
    });
  });

  it('ignores closed visits and other tables', async () => {
    mockSessions.mockResolvedValueOnce([
      session({ status: 'Closed' }),
      session({ serviceSessionId: 'session-2', tableNumber: 9 }),
    ]);

    await expect(resolveDineInSession({ label: '12' })).resolves.toBeNull();
  });

  it('propagates a network failure — it is not the answer "this table has no visit"', async () => {
    mockSessions.mockRejectedValueOnce(new Error('down'));

    await expect(resolveDineInSession({ label: '12' })).rejects.toThrow('down');
  });
});
it('picks the most recently opened visit when a table carries several', async () => {
  mockSessions.mockResolvedValueOnce([
    session({ serviceSessionId: 'session-old', openedAt: '2026-09-18T18:00:00Z' }),
    session({ serviceSessionId: 'session-new', openedAt: '2026-09-18T20:30:00Z' }),
  ]);

  await expect(resolveDineInSession({ label: '12' })).resolves.toEqual({
    tableId: 'table-12',
    tableNumber: 12,
    serviceSessionId: 'session-new',
  });
});

it('keeps the earlier visit when it is the newer one in list order', async () => {
  mockSessions.mockResolvedValueOnce([
    session({ serviceSessionId: 'session-new', openedAt: '2026-09-18T21:00:00Z' }),
    session({ serviceSessionId: 'session-old', openedAt: '2026-09-18T19:00:00Z' }),
  ]);

  await expect(resolveDineInSession({ label: '12' })).resolves.toEqual({
    tableId: 'table-12',
    tableNumber: 12,
    serviceSessionId: 'session-new',
  });
});

it('answers null when the matching visit carries no session id', async () => {
  mockSessions.mockResolvedValueOnce([{ tableNumber: 12, status: 'Open', serviceSessionId: undefined }]);

  await expect(resolveDineInSession({ label: '12' })).resolves.toBeNull();
});

it('resolves a lettered outdoor visit by its configured label and stable identity', async () => {
  mockSessions.mockResolvedValueOnce([session({ tableId: 'outdoor-11a', tableNumber: null, tableLabel: '11a' })]);

  await expect(
    resolveDineInSession({ label: '11A', tableId: 'outdoor-11a', serviceSessionId: 'session-1' }),
  ).resolves.toEqual({ tableId: 'outdoor-11a', serviceSessionId: 'session-1' });
});

it('resolves a pinned numbered visit even when its display label is empty', async () => {
  mockSessions.mockResolvedValueOnce([session({ tableId: 'table-7', tableNumber: 7, tableLabel: '' })]);

  await expect(
    resolveDineInSession({ label: '7', tableId: 'table-7', serviceSessionId: 'session-1' }),
  ).resolves.toEqual({ tableId: 'table-7', tableNumber: 7, serviceSessionId: 'session-1' });
});

it('does not use a missing display label to accept a pinned label-only visit', async () => {
  mockSessions.mockResolvedValueOnce([session({ tableId: 'outdoor-11a', tableNumber: null, tableLabel: '' })]);

  await expect(
    resolveDineInSession({ label: '11a', tableId: 'outdoor-11a', serviceSessionId: 'session-1' }),
  ).resolves.toBeNull();
});

it('resolves a manually typed lettered label without a link', async () => {
  mockSessions.mockResolvedValueOnce([session({ tableId: 'outdoor-11a', tableNumber: null, tableLabel: '11a' })]);

  await expect(resolveDineInSession({ label: '11A' })).resolves.toEqual({
    tableId: 'outdoor-11a',
    serviceSessionId: 'session-1',
  });
});

it('refuses an ambiguous label shared by distinct physical tables', async () => {
  mockSessions.mockResolvedValueOnce([
    session({ tableId: 'outdoor-11a', tableNumber: null, tableLabel: '11a' }),
    session({ tableId: 'other-11a', tableNumber: null, tableLabel: '11a', serviceSessionId: 'session-2' }),
  ]);

  await expect(resolveDineInSession({ label: '11a' })).resolves.toBeNull();
});

it('keeps number-only legacy visits compatible without inventing a table ID', async () => {
  mockSessions.mockResolvedValueOnce([session({ tableId: undefined, tableNumber: 7, tableLabel: '' })]);

  await expect(resolveDineInSession({ label: '7' })).resolves.toEqual({
    tableNumber: 7,
    serviceSessionId: 'session-1',
  });
});

it('refuses a deep link when its visit identity is stale', async () => {
  mockSessions.mockResolvedValueOnce([
    session({ tableId: 'outdoor-11a', tableNumber: null, tableLabel: '11a', serviceSessionId: 'new-session' }),
  ]);

  await expect(
    resolveDineInSession({ label: '11a', tableId: 'outdoor-11a', serviceSessionId: 'old-session' }),
  ).resolves.toBeNull();
});
