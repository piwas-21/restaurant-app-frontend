import { render, screen } from '@testing-library/react';
import OrderDetailsSummary from './OrderDetailsSummary';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, value?: string | { provider?: string }) => {
      const labels = jest.requireActual<typeof import('@/locales/en.json')>('@/locales/en.json').delivery_channels;
      if (key.startsWith('delivery_channels.'))
        return labels[key.split('.')[1] as keyof typeof labels].replace(
          '{{provider}}',
          typeof value === 'object' ? (value.provider ?? '') : '',
        );
      return typeof value === 'string' ? value : key;
    },
  }),
}));

it('displays unknown tax instead of the legacy zero and keeps merchant money in EUR', () => {
  const { container } = render(<OrderDetailsSummary order={marketplaceOrder()} />);
  expect(screen.getByText('Not reported by provider')).toBeInTheDocument();
  expect(container.textContent).not.toContain('CHF');
  expect(container.textContent).not.toContain('11.47');
  expect(container.textContent).toContain('5.00');
});
it('displays an explicitly reported zero tax as money', () => {
  const order = marketplaceOrder();
  order.externalOrder!.reportedTax = 0;
  render(<OrderDetailsSummary order={order} />);
  expect(screen.queryByText('Not reported by provider')).not.toBeInTheDocument();
  expect(screen.getByText(/0.00/)).toBeInTheDocument();
});
