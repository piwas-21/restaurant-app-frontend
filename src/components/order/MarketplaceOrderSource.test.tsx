import { render, screen } from '@testing-library/react';
import MarketplaceOrderSource from './MarketplaceOrderSource';
import { marketplaceOrder } from '@/utils/__fixtures__/marketplaceOrderFixture';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { provider?: string }) => {
      const labels = jest.requireActual<typeof import('@/locales/en.json')>('@/locales/en.json').delivery_channels;
      const label = labels[key.split('.')[1] as keyof typeof labels];
      return label.replace('{{provider}}', options?.provider ?? '');
    },
  }),
}));

it('shows source, safe display reference, test marker and payment custody', () => {
  render(<MarketplaceOrderSource source={marketplaceOrder().externalOrder} />);
  expect(screen.getByRole('region', { name: 'Order source' })).toBeInTheDocument();
  expect(screen.getByText('Uber Eats')).toBeInTheDocument();
  expect(screen.getByText('9116D')).toHaveAttribute('dir', 'auto');
  expect(screen.getByText('Test order')).toBeInTheDocument();
  expect(screen.getByText('Payment handled by Uber Eats')).toBeInTheDocument();
});
it('renders nothing for ordinary orders and no test marker for live source records', () => {
  const { container, rerender } = render(<MarketplaceOrderSource />);
  expect(container).toBeEmptyDOMElement();
  rerender(<MarketplaceOrderSource source={{ ...marketplaceOrder().externalOrder!, isSandbox: false }} />);
  expect(screen.queryByText('Test order')).not.toBeInTheDocument();
});

it('labels the provider phone access code separately and escapes its text', () => {
  const { container, rerender } = render(
    <MarketplaceOrderSource source={{ ...marketplaceOrder().externalOrder!, customerPhoneAccessCode: '555 55 555' }} />,
  );
  expect(screen.getByText('555 55 555')).toHaveAttribute('dir', 'ltr');
  expect(screen.getByText(/Phone access code/)).toBeInTheDocument();
  rerender(
    <MarketplaceOrderSource
      source={{ ...marketplaceOrder().externalOrder!, customerPhoneAccessCode: '<script>bad</script>' }}
    />,
  );
  expect(container.querySelector('script')).toBeNull();
  expect(screen.getByText('<script>bad</script>')).toBeInTheDocument();
});
