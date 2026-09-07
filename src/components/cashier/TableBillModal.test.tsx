import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TableBillModal from './TableBillModal';
import type { TableBillDto } from '@/types/order';
import { PaymentMethod } from '@/types/order';
import type { useTableBill } from '@/hooks/cashier/useTableBill';

// Echoes the key plus interpolation, so an assertion can match a key (the parity gate's own
// convention) and the applied-amount interpolation has something to bite on.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && typeof opts === 'object' && 'amount' in opts ? `${key}:${opts.amount}` : key,
    // TableBillLines renders the order time in the CHOSEN language, not the browser's.
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/utils/currency', () => ({
  formatPlainCurrency: (v: number) => `CHF ${v.toFixed(2)}`,
}));

const order = (over: Record<string, unknown>) =>
  ({
    id: 'o1',
    orderNumber: 'ORD-1042',
    status: 'Confirmed',
    orderDate: '2026-09-10T12:00:00Z',
    total: 30,
    totalPaid: 0,
    remainingAmount: 30,
    items: [
      {
        id: 'i1',
        productId: 'p1',
        productName: 'Wiener Schnitzel',
        quantity: 2,
        unitPrice: 12.75,
        itemTotal: 25.5,
      },
    ],
    payments: [],
    statusHistory: [],
    ...over,
  }) as never;

const bill = (over: Partial<TableBillDto>): TableBillDto =>
  ({
    tableNumber: 7,
    generatedAt: '2026-09-10T12:30:00Z',
    orders: [order({})],
    orderCount: 1,
    subTotal: 30,
    tax: 0,
    discount: 0,
    tip: 0,
    total: 30,
    totalPaid: 0,
    remaining: 30,
    ...over,
  }) as TableBillDto;

const billState = (over: Partial<ReturnType<typeof useTableBill>>): ReturnType<typeof useTableBill> =>
  ({
    tableNumberInput: '7',
    setTableNumberInput: jest.fn(),
    tableNumber: 7,
    hasValidTable: true,
    bill: null,
    isLoading: false,
    isPaying: false,
    error: null,
    loadBill: jest.fn(),
    payBill: jest.fn().mockResolvedValue(true),
    reset: jest.fn(),
    ...over,
  }) as ReturnType<typeof useTableBill>;

const renderDialog = (state: ReturnType<typeof useTableBill>, onSuccess = jest.fn()) =>
  render(<TableBillModal isOpen onClose={jest.fn()} billState={state} onSuccess={onSuccess} />);

/**
 * The one-bill-per-table dialog: a table's bill is the UNION of its open orders,
 * rendered as per-order groups, and ONE tender is dispatched against the bill.
 */
describe('TableBillModal', () => {
  it('renders each open order as its own group with its lines and totals', () => {
    renderDialog(
      billState({
        bill: bill({
          orders: [
            order({ id: 'o1', orderNumber: 'ORD-1042', total: 30 }),
            order({ id: 'o2', orderNumber: 'ORD-1051', total: 20, items: [] }),
          ],
          orderCount: 2,
          total: 50,
          totalPaid: 10,
          remaining: 40,
        }),
      }),
    );

    // One group per ordering round — the waiter can tell the rounds apart.
    expect(screen.getByText('ORD-1042')).toBeInTheDocument();
    expect(screen.getByText('ORD-1051')).toBeInTheDocument();

    // The line, with its quantity and backend-computed line total.
    expect(screen.getByText('Wiener Schnitzel')).toBeInTheDocument();
    expect(screen.getByText('2×')).toBeInTheDocument();
    expect(screen.getByText('CHF 25.50')).toBeInTheDocument();

    // Bill-level sums, not any single order's.
    expect(screen.getByText('CHF 50.00')).toBeInTheDocument();
    expect(screen.getByText('CHF 40.00')).toBeInTheDocument();
  });

  it('loads the bill for the entered table number', () => {
    const state = billState({ tableNumberInput: '', hasValidTable: false });
    renderDialog(state);

    fireEvent.change(screen.getByLabelText('cashier.table_bill.table_number'), { target: { value: '12' } });
    expect(state.setTableNumberInput).toHaveBeenCalledWith('12');

    // The load button is disabled until the number parses as a table number.
    const load = screen.getByRole('button', { name: 'cashier.table_bill.load' });
    expect(load).toBeDisabled();
  });

  it('dispatches ONE bill tender with the entered amount and method', async () => {
    const state = billState({
      bill: bill({ remaining: 40 }),
      payBill: jest.fn().mockResolvedValue(true),
    });
    const onSuccess = jest.fn();
    renderDialog(state, onSuccess);

    fireEvent.change(screen.getByLabelText('cashier.payment_amount'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'cashier.table_bill.add_payment' }));

    await waitFor(() => expect(state.payBill).toHaveBeenCalledWith({ amount: 40, paymentMethod: PaymentMethod.Cash }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('cashier.table_bill.payment_applied:40.00'));
  });

  it('surfaces the backend refusal when a tender exceeds the bill remaining', async () => {
    // The backend is the authority on the bill's balance (it may have changed under us);
    // the dialog just renders the refusal the hook caught.
    const state = billState({
      bill: bill({ remaining: 40 }),
      payBill: jest.fn().mockResolvedValue(false),
      error: "Payment amount exceeds the bill's remaining balance of 40.00",
    });
    renderDialog(state);

    expect(screen.getByText("Payment amount exceeds the bill's remaining balance of 40.00")).toBeInTheDocument();
    expect(state.payBill).not.toHaveBeenCalled();
  });

  it('disables paying once the bill is fully settled', () => {
    renderDialog(
      billState({
        bill: bill({
          remaining: 0,
          totalPaid: 30,
          orders: [order({ remainingAmount: 0, totalPaid: 30, status: 'Completed' })],
        }),
      }),
    );

    expect(screen.getByRole('button', { name: 'cashier.table_bill.add_payment' })).toBeDisabled();
    expect(screen.getByText('cashier.table_bill.settled')).toBeInTheDocument();
  });

  it('shows the load failure instead of a bill', () => {
    renderDialog(billState({ error: 'No open orders found for table 42' }));

    expect(screen.getByText('No open orders found for table 42')).toBeInTheDocument();
    expect(screen.queryByText('cashier.table_bill.total')).not.toBeInTheDocument();
  });

  it('resets state when closed, so the next table starts blank', () => {
    const state = billState({ bill: bill({}) });
    renderDialog(state);

    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(state.reset).toHaveBeenCalled();
  });
});
