import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ActiveOrdersPanel from './ActiveOrdersPanel';
import type { OrderDto } from '@/types/order';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key, i18n: { language: 'en' } }),
}));

function order(id: string, orderNumber: string, status: string): OrderDto {
  return {
    id,
    orderNumber,
    tableNumber: 7,
    status,
    type: 'DineIn',
    orderDate: '2026-09-16T12:00:00Z',
    items: [],
    total: 10,
  } as unknown as OrderDto;
}

describe('ActiveOrdersPanel', () => {
  it('does not apply a second active-only filter to the explicit All view', () => {
    render(
      <ActiveOrdersPanel
        orders={[order('pending', '1001', 'Pending'), order('completed', '1002', 'Completed')]}
        selectedTableNumber={null}
        statusFilter="all"
        onStatusChange={jest.fn()}
      />,
    );

    expect(screen.getByText('#1001')).toBeInTheDocument();
    expect(screen.getByText('#1002')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All Orders' })).toBeInTheDocument();
  });
});
