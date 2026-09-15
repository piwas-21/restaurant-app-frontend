import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { OrderDto, OrderType } from '@/types/order';
import QuickConfirmModal from './QuickConfirmModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

it('presents a tableless dine-in order as dine-in, not delivery', () => {
  const order = {
    id: 'order-1',
    orderNumber: '1042',
    type: OrderType.DineIn,
    tableNumber: null,
    status: 'Pending',
    customerName: 'Guest',
    total: 18,
    items: [],
  } as unknown as OrderDto;

  render(
    <QuickConfirmModal order={order} isOpen={true} onClose={jest.fn()} onConfirm={jest.fn()} onCancel={jest.fn()} />,
  );

  expect(screen.getByText(/Dine In/)).toBeInTheDocument();
  expect(screen.queryByText(/Delivery/)).not.toBeInTheDocument();
});
