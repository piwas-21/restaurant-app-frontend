import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import CashierStatusBadges from './CashierStatusBadges';
import type { OrderDto } from '@/types/order';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const order = {
  status: 'Preparing',
  paymentStatus: 'Pending',
} as unknown as OrderDto;

describe('CashierStatusBadges', () => {
  it('labels the two pills so fulfilment and payment are distinguishable', () => {
    render(<CashierStatusBadges order={order} />);

    expect(screen.getByText('cashier.workspace.badge_fulfilment')).toBeInTheDocument();
    expect(screen.getByText('cashier.workspace.badge_payment')).toBeInTheDocument();
  });
});
