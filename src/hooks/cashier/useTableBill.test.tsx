import '@testing-library/jest-dom';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTableBill } from './useTableBill';
import { addTableBillPayment, getTableBill } from '@/services/cashierService';
import { getErrorMessage } from '@/utils/apiClient';
import type { TableBillDto } from '@/types/order';

jest.mock('@/services/cashierService');
jest.mock('@/utils/apiClient', () => ({
  getErrorMessage: jest.fn(() => null),
  ApiError: class extends Error {},
}));

const mockedGetBill = jest.mocked(getTableBill);
const mockedAddPayment = jest.mocked(addTableBillPayment);
const mockedGetErrorMessage = jest.mocked(getErrorMessage);

const bill = (tableNumber: number): TableBillDto =>
  ({
    tableNumber,
    generatedAt: '2026-09-10T12:30:00Z',
    orders: [],
    orderCount: 0,
    subTotal: 0,
    tax: 0,
    discount: 0,
    tip: 0,
    total: 30,
    totalPaid: 0,
    remaining: 30,
  }) as TableBillDto;

/**
 * The hook owns the bill flow's money decisions, so the two race-shaped rules are
 * pinned here: the tender targets the bill ON SCREEN (never a re-parsed input the
 * user edited after loading), and only the newest load may write state.
 */
describe('useTableBill', () => {
  it('targets the tender at bill.tableNumber, not the edited input', async () => {
    mockedGetBill.mockResolvedValue(bill(7));
    mockedAddPayment.mockResolvedValue(bill(7));
    const { result } = renderHook(() => useTableBill());

    act(() => result.current.setTableNumberInput('7'));
    await act(async () => {
      result.current.loadBill();
    });
    await waitFor(() => expect(result.current.bill?.tableNumber).toBe(7));

    // The cashier edits the input (typo, next table) WITHOUT reloading — the on-screen
    // bill is still table 7's, so the tender must still go to table 7.
    act(() => result.current.setTableNumberInput('8'));
    let paid = false;
    await act(async () => {
      paid = await result.current.payBill({
        operationId: '11111111-1111-4111-8111-111111111111',
        paymentMethod: 'Cash',
        amount: 10,
      });
    });

    expect(paid).toBe(true);
    expect(mockedAddPayment).toHaveBeenCalledWith(7, {
      operationId: '11111111-1111-4111-8111-111111111111',
      paymentMethod: 'Cash',
      amount: 10,
    });
  });

  it("ignores a slow older load so the screen never shows another table's bill", async () => {
    let resolveFirst!: (b: TableBillDto) => void;
    mockedGetBill
      .mockImplementationOnce(() => new Promise<TableBillDto>((res) => (resolveFirst = res)))
      .mockResolvedValue(bill(2));

    const { result } = renderHook(() => useTableBill());

    act(() => result.current.setTableNumberInput('1'));
    act(() => {
      result.current.loadBill();
    });
    act(() => result.current.setTableNumberInput('2'));
    act(() => {
      result.current.loadBill();
    });
    // Request 2 resolves; request 1 is still pending.
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.bill?.tableNumber).toBe(2));

    // Request 1 resolves LAST — it must not overwrite table 2's bill.
    await act(async () => {
      resolveFirst(bill(1));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.bill?.tableNumber).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('falls back to the translated sentence when the error carries no message', async () => {
    mockedGetBill.mockRejectedValue(new Error('network down'));
    mockedGetErrorMessage.mockReturnValue(null);
    const { result } = renderHook(() => useTableBill());

    act(() => result.current.setTableNumberInput('7'));
    await act(async () => {
      result.current.loadBill();
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('cashier.table_bill.error.loading');
  });
});
