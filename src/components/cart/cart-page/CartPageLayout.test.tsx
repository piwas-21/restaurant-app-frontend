import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import TableGuestRouteRuntimeLoader from '@/contexts/TableGuestRouteRuntimeLoader';
import { useCheckoutTableGuestState } from '@/contexts/CheckoutTableGuestStateContext';
import CartPageLayout from './CartPageLayout';

const mockObservedPhases: string[] = [];
let mockRuntimeChunkLoaded = true;

afterEach(() => {
  mockRuntimeChunkLoaded = true;
});

jest.mock('next/dynamic', () => {
  const React: typeof import('react') = jest.requireActual('react');
  const { CheckoutTableGuestStateProvider } = jest.requireActual(
    '@/contexts/CheckoutTableGuestStateContext',
  ) as typeof import('@/contexts/CheckoutTableGuestStateContext');

  return {
    __esModule: true,
    default: (loader: () => unknown, options?: { loading?: (loadingProps: object) => React.ReactNode }) => {
      if (!String(loader).includes('TableGuestRouteRuntimeLoader')) return () => null;

      return function Runtime({
        children,
        readPublicTableGuestFeature,
      }: {
        readonly children: React.ReactNode;
        readonly readPublicTableGuestFeature: boolean;
      }) {
        if (!mockRuntimeChunkLoaded) return options?.loading?.({}) ?? null;
        if (!readPublicTableGuestFeature) return children;

        return (
          <CheckoutTableGuestStateProvider
            value={{ phase: 'active', hasPendingRound: false, hasAcknowledgement: false }}
          >
            {children}
          </CheckoutTableGuestStateProvider>
        );
      };
    },
  };
});

jest.mock('@/hooks/cart/useCartPage', () => {
  const { useCheckoutTableGuestState } = jest.requireActual(
    '@/contexts/CheckoutTableGuestStateContext',
  ) as typeof import('@/contexts/CheckoutTableGuestStateContext');

  return {
    useCartPage: () => {
      mockObservedPhases.push(useCheckoutTableGuestState().phase);
      return { state: { items: [] } };
    },
  };
});

jest.mock('@/hooks/useTenantPublicNavigation', () => ({ useTenantPublicNavigation: () => ({ menuHref: '/menu' }) }));
jest.mock(
  '@/components/TenantLink',
  () =>
    function Link({ children }: { readonly children: ReactNode }) {
      return <span>{children}</span>;
    },
);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

function CheckoutPhaseProbe() {
  return <output>{useCheckoutTableGuestState().phase}</output>;
}

const styles = { page: {}, item: {}, summary: {} };

it('keeps cart chrome visible while the runtime chunk is unloaded without mounting the checkout hook', () => {
  mockRuntimeChunkLoaded = false;
  mockObservedPhases.length = 0;

  render(<CartPageLayout styles={styles} />);

  expect(screen.getByRole('heading', { name: 'Your Cart' })).toBeInTheDocument();
  const loadingStatus = screen.getByRole('status');
  expect(loadingStatus.tagName).toBe('OUTPUT');
  expect(loadingStatus).toHaveAttribute('aria-live', 'polite');
  expect(loadingStatus).toHaveTextContent('Loading...');
  expect(mockObservedPhases).toEqual([]);
});

it('mounts the cart checkout hook inside the admitted visit provider', () => {
  mockRuntimeChunkLoaded = true;
  mockObservedPhases.length = 0;

  render(<CartPageLayout styles={styles} />);

  expect(screen.getByRole('heading', { name: 'Your Cart' })).toBeInTheDocument();
  expect(mockObservedPhases).toEqual(['active']);
});

it('keeps checkout context in its default loading state when public feature admission is omitted', () => {
  render(
    <TableGuestRouteRuntimeLoader readPublicTableGuestFeature={false}>
      <CheckoutPhaseProbe />
    </TableGuestRouteRuntimeLoader>,
  );

  expect(screen.getByText('loading')).toBeInTheDocument();
});
