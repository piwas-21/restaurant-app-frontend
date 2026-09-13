import { apiClient } from '@/utils/apiClient';
import { PaymentMethod, type TableServiceSessionDto } from '@/types/order';
import {
  addTableServiceSessionPayment,
  closeTableServiceSession,
  getActiveTableServiceSessions,
  getTableServiceSession,
  openTableServiceSession,
} from './tableServiceSessionService';

jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const bill = {
  tableNumber: 7,
  generatedAt: '2026-09-12T18:00:00Z',
  orders: [],
  orderCount: 0,
  subTotal: 0,
  tax: 0,
  discount: 0,
  tip: 0,
  total: 0,
  totalPaid: 0,
  remaining: 0,
};
const session = {
  serviceSessionId: 'session-1',
  tableNumber: 7,
  currency: 'EUR',
  status: 'Open',
  version: 4,
  openedAt: '2026-09-12T18:00:00Z',
  closedAt: null,
  roundCount: 0,
  ageMinutes: 5,
  outstanding: 0,
  bill,
} as TableServiceSessionDto;

beforeEach(() => jest.clearAllMocks());

describe('table service session contract', () => {
  it('reads active sessions and explicit detail with auth', async () => {
    mockGet.mockResolvedValue({ success: true, data: [session] });
    await expect(getActiveTableServiceSessions()).resolves.toEqual([session]);
    expect(mockGet).toHaveBeenCalledWith('/api/table-service-sessions', { requireAuth: true });

    mockGet.mockResolvedValue({ success: true, data: session });
    await expect(getTableServiceSession('session/1')).resolves.toEqual(session);
    expect(mockGet).toHaveBeenLastCalledWith('/api/table-service-sessions/session%2F1', { requireAuth: true });
  });

  it('opens explicitly and pins idempotent payment and version to the session route', async () => {
    mockPost.mockResolvedValue({ success: true, data: session });
    await expect(openTableServiceSession(7)).resolves.toEqual(session);
    expect(mockPost).toHaveBeenLastCalledWith('/api/table-service-sessions', { tableNumber: 7 }, { requireAuth: true });

    const payment = {
      operationId: '11111111-1111-4111-8111-111111111111',
      expectedVersion: 4,
      paymentMethod: PaymentMethod.Cash,
      amount: 20,
      currency: 'EUR',
    };
    await addTableServiceSessionPayment('session-1', payment);
    expect(mockPost).toHaveBeenLastCalledWith('/api/table-service-sessions/session-1/payments', payment, {
      requireAuth: true,
    });

    await closeTableServiceSession('session-1', { expectedVersion: 5 });
    expect(mockPost).toHaveBeenLastCalledWith(
      '/api/table-service-sessions/session-1/close',
      { expectedVersion: 5 },
      { requireAuth: true },
    );
  });

  it('does not turn a failed envelope into a successful empty session', async () => {
    mockGet.mockResolvedValue({ success: false, message: 'Not found' });
    await expect(getTableServiceSession('session-1')).rejects.toThrow('Not found');
  });

  it('honors a failed envelope even when it includes an empty list payload', async () => {
    mockGet.mockResolvedValue({ success: false, data: [], message: 'Session read failed' });
    await expect(getActiveTableServiceSessions()).rejects.toThrow('Session read failed');
  });
});
