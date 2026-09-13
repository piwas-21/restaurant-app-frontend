import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PaymentMethod, type TableServiceSessionDto } from '@/types/order';
import CashierTablePaymentForm from './CashierTablePaymentForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${Object.values(options).join(',')}` : key,
  }),
}));

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
    serviceSessionId: 'session-1',
    serviceSessionVersion: 4,
    currency: 'EUR',
    generatedAt: '2026-09-12T18:00:00Z',
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

const renderForm = (onSubmit = jest.fn().mockResolvedValue(undefined)) => {
  render(<CashierTablePaymentForm session={session} disabled={false} onSubmit={onSubmit} />);
  return onSubmit;
};

describe('CashierTablePaymentForm', () => {
  it('blocks a cash tender when received cash does not cover the amount', async () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'cashier.cash_received' }), {
      target: { value: '19' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'cashier.tables.payment_submit' }));

    await waitFor(() => expect(screen.getByText('cashier.cash_received_too_low')).toBeInTheDocument());
    const received = screen.getByRole('spinbutton', { name: 'cashier.cash_received' });
    expect(received).toHaveAttribute('aria-invalid', 'true');
    expect(received).toHaveAccessibleDescription('cashier.cash_received_too_low');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rotates the operation key when transaction details change', async () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: PaymentMethod.CreditCard } });
    const transaction = screen.getByRole('textbox', { name: 'cashier.transaction_id' });
    const notes = screen.getByRole('textbox', { name: 'cashier.notes' });

    fireEvent.change(transaction, { target: { value: 'terminal-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'cashier.tables.payment_submit' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const firstOperation = onSubmit.mock.calls[0][0].operationId;

    fireEvent.change(screen.getByRole('combobox'), { target: { value: PaymentMethod.CreditCard } });
    fireEvent.change(transaction, { target: { value: 'terminal-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'cashier.tables.payment_submit' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    const secondOperation = onSubmit.mock.calls[1][0].operationId;

    fireEvent.change(screen.getByRole('combobox'), { target: { value: PaymentMethod.CreditCard } });
    fireEvent.change(notes, { target: { value: 'manual confirmation' } });
    fireEvent.click(screen.getByRole('button', { name: 'cashier.tables.payment_submit' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(3));
    const thirdOperation = onSubmit.mock.calls[2][0].operationId;

    expect(secondOperation).not.toBe(firstOperation);
    expect(thirdOperation).not.toBe(secondOperation);
  });
});
