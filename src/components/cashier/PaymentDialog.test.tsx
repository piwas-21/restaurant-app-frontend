import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentDialog from './PaymentDialog';
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

const open = (onConfirm: jest.Mock, isLoading = false) =>
  render(<PaymentDialog order={order} isOpen onClose={jest.fn()} onConfirm={onConfirm} isLoading={isLoading} />);

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
describe('PaymentDialog — failure retains the form', () => {
  it('keeps the dialog open with the entered amount when the mutation rejects', async () => {
    const onConfirm = jest.fn().mockRejectedValueOnce(new Error('Terminal offline'));
    open(onConfirm);

    fillForm();
    fireEvent.click(confirmButton());

    await waitFor(() => expect(screen.getByText('Terminal offline')).toBeInTheDocument());
    // Still open, still holding the cashier's input.
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(18.5);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('resets and lets the hook close the dialog only on success', async () => {
    const onConfirm = jest.fn().mockResolvedValueOnce(undefined);
    open(onConfirm);

    fillForm();
    fireEvent.click(confirmButton());

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ amount: 18.5 })));
    await waitFor(() => expect((screen.getByPlaceholderText('0.00') as HTMLInputElement).value).toBe(''));
  });

  it('locks the confirm control while a submit is pending', () => {
    open(jest.fn(), true);

    // Pending swaps the label for the loading key; both must be a single disabled control.
    const pending = screen.getByRole('button', { name: 'common.loading' });
    expect(pending).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'cashier.add_payment' })).not.toBeInTheDocument();
  });
});
