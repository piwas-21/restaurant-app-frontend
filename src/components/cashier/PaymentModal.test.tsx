import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentModal from './PaymentModal';
import type { OrderDto } from '@/types/order';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));

const order = {
  id: 'o1',
  orderNumber: 'A-1',
  total: 40,
  totalPaid: 15,
  remainingAmount: 25,
} as unknown as OrderDto;

const open = (onConfirm: jest.Mock, isLoading = false, isCheckingPayment = false) =>
  render(
    <PaymentModal
      order={order}
      isOpen
      onClose={jest.fn()}
      onConfirm={onConfirm}
      isLoading={isLoading}
      isCheckingPayment={isCheckingPayment}
    />,
  );

const confirmButton = () => screen.getByRole('button', { name: 'cashier.add_payment' });

const fillForm = () => {
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '18.50' } });
};

/**
 * #767 (C04): a failed tender used to close and reset — the wrapper swallowed the rejection,
 * the dialog read the resolved callback as success, and the cashier had to re-enter everything.
 * These tests pin the opposite contract: rejection keeps the dialog and its input, resolution
 * closes it, and a pending submit cannot be double-fired.
 */
describe('PaymentModal — failure retains the form', () => {
  it('keeps the dialog open with the entered amount when the mutation rejects', async () => {
    const onConfirm = jest.fn().mockRejectedValueOnce(new Error('Terminal offline'));
    open(onConfirm);

    fillForm();
    fireEvent.change(screen.getByRole('textbox', { name: 'cashier.transaction_id' }), {
      target: { value: 'terminal-1' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'cashier.notes' }), {
      target: { value: 'keep this payload' },
    });
    fireEvent.click(confirmButton());

    await waitFor(() => expect(screen.getByText('Terminal offline')).toBeInTheDocument());
    // Still open, still holding the cashier's full input payload.
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(18.5);
    expect(screen.getByRole('textbox', { name: 'cashier.transaction_id' })).toHaveValue('terminal-1');
    expect(screen.getByRole('textbox', { name: 'cashier.notes' })).toHaveValue('keep this payload');
    const firstOperation = onConfirm.mock.calls[0][0].operationId;
    fireEvent.click(confirmButton());
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    expect(onConfirm.mock.calls[1][0].operationId).toBe(firstOperation);
  });

  it('resets and lets the hook close the dialog only on success', async () => {
    const onConfirm = jest.fn().mockResolvedValueOnce(undefined);
    open(onConfirm);

    fillForm();
    fireEvent.click(confirmButton());

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ amount: 18.5 })));
    await waitFor(() => expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe(''));
  });

  it('labels manual card recording honestly and offers no pretend online capture', () => {
    open(jest.fn());

    fireEvent.change(screen.getByRole('combobox', { name: /cashier.payment_method/ }), {
      target: { value: 'CreditCard' },
    });

    expect(screen.getByText('cashier.standalone_card_instruction')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cashier.record_card_payment' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /online/i })).not.toBeInTheDocument();
  });

  it('shows change but submits only the amount applied to the bill', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    open(onConfirm);
    fireEvent.change(screen.getByRole('spinbutton', { name: /cashier.payment_amount/ }), { target: { value: '20' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'cashier.cash_received' }), { target: { value: '50' } });

    expect(screen.getByRole('status')).toHaveTextContent('30.00');
    fireEvent.click(screen.getByRole('button', { name: 'cashier.add_payment' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ amount: 20 })));
  });

  it('keeps the operation key when only transient received cash changes after failure', async () => {
    const onConfirm = jest.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(undefined);
    open(onConfirm);
    fireEvent.change(screen.getByRole('spinbutton', { name: /cashier.payment_amount/ }), { target: { value: '20' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'cashier.cash_received' }), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'cashier.add_payment' }));
    await screen.findByText('timeout');
    const firstOperationId = onConfirm.mock.calls[0][0].operationId;

    fireEvent.change(screen.getByRole('spinbutton', { name: 'cashier.cash_received' }), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'cashier.add_payment' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
    expect(onConfirm.mock.calls[1][0].operationId).toBe(firstOperationId);
  });

  it('refuses cash below the amount being applied', async () => {
    const onConfirm = jest.fn();
    open(onConfirm);
    fireEvent.change(screen.getByRole('spinbutton', { name: /cashier.payment_amount/ }), { target: { value: '20' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'cashier.cash_received' }), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'cashier.add_payment' }));

    expect(await screen.findByText('cashier.cash_received_too_low')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('locks the confirm control while a submit is pending', () => {
    open(jest.fn(), true);

    // Pending swaps the label for the loading key; both must be a single disabled control.
    const pending = screen.getByRole('button', { name: 'common.loading' });
    expect(pending).toBeDisabled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'cashier.add_payment' })).not.toBeInTheDocument();
  });

  it('shows a localized checking state and prevents a duplicate submit', () => {
    const onConfirm = jest.fn();
    open(onConfirm, true, true);

    expect(screen.getByRole('status', { name: 'cashier.payment_checking' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cashier.payment_checking' })).toBeDisabled();
    expect(screen.getByPlaceholderText('0.00')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'cashier.payment_checking' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
