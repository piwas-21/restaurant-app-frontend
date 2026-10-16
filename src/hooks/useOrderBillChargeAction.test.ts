import { act, renderHook, waitFor } from '@testing-library/react';
import { useOrderBillChargeAction } from './useOrderBillChargeAction';
import { addOrderBillCharges } from '@/services/billChargeService';
import { ApiError } from '@/utils/apiClient';
import type { OrderDto } from '@/types/order';

jest.mock('@/components/AuthContext', () => ({ useOptionalAuth: () => ({ user: { userId: 'staff-a' } }) }));
jest.mock('@/services/billChargeService', () => ({ addOrderBillCharges: jest.fn() }));
const add = jest.mocked(addOrderBillCharges);
const order = { id: '10000000-0000-4000-8000-000000000001', version: 3 } as OrderDto;
const refresh = jest.fn();
const lock = jest.fn();
beforeEach(() => {
  sessionStorage.clear();
  jest.clearAllMocks();
});
it('persists an uncertain save and replays the exact operation after reload while collection stays locked', async () => {
  add.mockRejectedValueOnce(new TypeError('network'));
  const first = renderHook(() => useOrderBillChargeAction(order, false, refresh, lock));
  await waitFor(() => expect(first.result.current.hydrated).toBe(true));
  act(() => first.result.current.setValues([{ key: 'service_fee', amount: 5 }]));
  await act(() => first.result.current.save());
  const operation = add.mock.calls[0];
  expect(first.result.current.pending).not.toBeNull();
  expect(lock).toHaveBeenLastCalledWith(true);
  first.unmount();
  const recovered = renderHook(() => useOrderBillChargeAction({ ...order, version: 4 }, true, refresh, lock));
  await waitFor(() => expect(recovered.result.current.pending).not.toBeNull());
  add.mockResolvedValueOnce({ ...order, version: 4 });
  await act(() => recovered.result.current.save());
  expect(add.mock.calls[1]).toEqual(operation);
  expect(recovered.result.current.pending).toBeNull();
  expect(lock).toHaveBeenLastCalledWith(false);
});
it('clears a definite stale-version refusal so staff can edit and use a fresh quote', async () => {
  add.mockRejectedValueOnce(new ApiError(409, 'changed'));
  const view = renderHook(() => useOrderBillChargeAction(order, false, refresh, lock));
  await waitFor(() => expect(view.result.current.hydrated).toBe(true));
  act(() => view.result.current.setValues([{ key: 'service_fee', amount: 5 }]));
  await act(() => view.result.current.save());
  expect(view.result.current.pending).toBeNull();
  expect(refresh).toHaveBeenCalled();
  expect(lock).toHaveBeenLastCalledWith(false);
});

it.each([401, 403, 404])('retains the original operation when recovery loses access (%s)', async (status) => {
  add.mockRejectedValueOnce(new TypeError('lost response'));
  const first = renderHook(() => useOrderBillChargeAction(order, false, refresh, lock));
  await waitFor(() => expect(first.result.current.hydrated).toBe(true));
  act(() => first.result.current.setValues([{ key: 'service_fee', amount: 5 }]));
  await act(() => first.result.current.save());
  const original = first.result.current.pending;
  add.mockRejectedValueOnce(new ApiError(status, 'access unavailable'));
  await act(() => first.result.current.save());
  expect(first.result.current.pending).toEqual(original);
  expect(lock).toHaveBeenLastCalledWith(true);
  expect(sessionStorage.getItem(`staff.bill-charge:staff-a:${order.id}`)).not.toBeNull();
});
