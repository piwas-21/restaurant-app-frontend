import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import CashierCollectionSuccess from './CashierCollectionSuccess';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key),
  }),
}));

const order = { id: 'order-1', currency: 'EUR' } as OrderDto;

describe('CashierCollectionSuccess', () => {
  it('keeps signed remaining credit and offers receipt choices', () => {
    const print = jest.fn();
    render(
      <CashierCollectionSuccess
        order={order}
        payment={{ applied: 20, change: 1.5, remaining: -1.5 }}
        onNextSale={jest.fn()}
        onReturnToOrder={jest.fn()}
        onPrintReceipt={print}
      />,
    );
    expect(screen.getByText(/cashier.collection.credit/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'cashier.collection.print_receipt' }));
    expect(print).toHaveBeenCalledWith(order);
    expect(screen.getByText('cashier.collection.receipt_printed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'cashier.collection.no_receipt' }));
    expect(screen.getByText('cashier.collection.receipt_skipped')).toBeInTheDocument();
  });
});
