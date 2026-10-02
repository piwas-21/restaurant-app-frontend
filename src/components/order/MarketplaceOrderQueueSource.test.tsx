import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import MarketplaceOrderQueueSource from './MarketplaceOrderQueueSource';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('shows the provider display ID and flags a pending human decision', () => {
  const order = marketplaceOrder();
  render(<MarketplaceOrderQueueSource order={order} />);

  expect(screen.getByText('9116D')).toHaveAttribute('dir', 'ltr');
  expect(screen.getByText('delivery_channels.uber_eats')).toBeInTheDocument();
  expect(screen.getByText('marketplaceStaff.decision_needed')).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'marketplaceStaff.order_source' })).toBeInTheDocument();
});

it('does not show a decision warning after the provider accepts', () => {
  const order = marketplaceOrder();
  order.externalOrder!.externalState = 'ACCEPTED';
  order.status = 'Confirmed';
  render(<MarketplaceOrderQueueSource order={order} />);

  expect(screen.queryByText('marketplaceStaff.decision_needed')).not.toBeInTheDocument();
});
