import { resolveDineInSession } from './newSaleSession';
import { getActiveTableServiceSessions } from '@/services/tableServiceSessionService';

jest.mock('@/services/tableServiceSessionService', () => ({
  getActiveTableServiceSessions: jest.fn(),
}));

const mockSessions = getActiveTableServiceSessions as jest.Mock;

const session = (overrides: Record<string, unknown> = {}) => ({
  serviceSessionId: 'session-1',
  tableNumber: 12,
  status: 'Open',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resolveDineInSession', () => {
  it('returns the open visit matching the table number', async () => {
    mockSessions.mockResolvedValueOnce([session({ tableNumber: 7 }), session()]);

    await expect(resolveDineInSession(12)).resolves.toBe('session-1');
  });

  it('ignores closed visits and other tables', async () => {
    mockSessions.mockResolvedValueOnce([
      session({ status: 'Closed' }),
      session({ serviceSessionId: 'session-2', tableNumber: 9 }),
    ]);

    await expect(resolveDineInSession(12)).resolves.toBeNull();
  });

  it('propagates a network failure — it is not the answer "this table has no visit"', async () => {
    mockSessions.mockRejectedValueOnce(new Error('down'));

    await expect(resolveDineInSession(12)).rejects.toThrow('down');
  });
});
it('picks the most recently opened visit when a table carries several', async () => {
  mockSessions.mockResolvedValueOnce([
    session({ serviceSessionId: 'session-old', openedAt: '2026-09-18T18:00:00Z' }),
    session({ serviceSessionId: 'session-new', openedAt: '2026-09-18T20:30:00Z' }),
  ]);

  await expect(resolveDineInSession(12)).resolves.toBe('session-new');
});

it('keeps the earlier visit when it is the newer one in list order', async () => {
  mockSessions.mockResolvedValueOnce([
    session({ serviceSessionId: 'session-new', openedAt: '2026-09-18T21:00:00Z' }),
    session({ serviceSessionId: 'session-old', openedAt: '2026-09-18T19:00:00Z' }),
  ]);

  await expect(resolveDineInSession(12)).resolves.toBe('session-new');
});

it('answers null when the matching visit carries no session id', async () => {
  mockSessions.mockResolvedValueOnce([{ tableNumber: 12, status: 'Open', serviceSessionId: undefined }]);

  await expect(resolveDineInSession(12)).resolves.toBeNull();
});
