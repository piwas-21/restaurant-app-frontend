import { act, renderHook, waitFor } from '@testing-library/react';
import { PaymentMethod, type TableServiceSessionDto } from '@/types/order';
import { addTableServiceSessionPayment, getTableServiceSession } from '@/services/tableServiceSessionService';
import { useTableServiceSession } from './useTableServiceSession';

jest.mock('@/services/tableServiceSessionService');

const mockedGet = jest.mocked(getTableServiceSession);
const mockedAdd = jest.mocked(addTableServiceSessionPayment);
const session: TableServiceSessionDto = {
  serviceSessionId: 'session-1',
  tableNumber: 7,
  currency: 'EUR',
  status: 'Open',
  version: 4,
  openedAt: '2026-09-12T18:00:00Z',
  closedAt: null,
  roundCount: 1,
  ageMinutes: 10,
  outstanding: 20,
  bill: {
    tableNumber: 7,
    generatedAt: '2026-09-12T18:00:00Z',
    serviceSessionId: 'session-1',
    serviceSessionVersion: 4,
    currency: 'EUR',
    orders: [],
    orderCount: 0,
    subTotal: 20,
    tax: 0,
    discount: 0,
    tip: 0,
    total: 20,
    totalPaid: 0,
    remaining: 20,
  },
};
const payment = {
  operationId: '11111111-1111-4111-8111-111111111111',
  expectedVersion: 4,
  paymentMethod: PaymentMethod.Cash,
  amount: 20,
  tipMinor: 125,
  currency: 'EUR',
};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  window.sessionStorage.clear();
  mockedGet.mockResolvedValue(session);
});

afterEach(() => jest.restoreAllMocks());

it('refuses payment before mutation when the journal write is dropped and permits retry after storage recovers', async () => {
  const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string) {
    if (this !== window.sessionStorage || key !== 'cashier.pending-table-operation') return;
  });
  mockedAdd.mockResolvedValue({ ...session, version: 5, outstanding: 0 });
  const { result } = renderHook(() => useTableServiceSession('session-1'));
  await waitFor(() => expect(result.current.session).not.toBeNull());

  await act(async () => {
    await expect(result.current.submitPayment(payment)).rejects.toThrow('cashier.payment_recovery_unavailable');
  });

  expect(mockedAdd).not.toHaveBeenCalled();
  expect(result.current.error).toBe('cashier.payment_recovery_unavailable');
  expect(result.current.isMutating).toBe(false);
  expect(result.current.pendingOperation).toBeNull();

  setItem.mockRestore();
  await act(async () => {
    await result.current.submitPayment(payment);
  });

  expect(mockedAdd).toHaveBeenCalledTimes(1);
  expect(mockedAdd).toHaveBeenCalledWith('session-1', payment);
  expect(result.current.error).toBeNull();
});
