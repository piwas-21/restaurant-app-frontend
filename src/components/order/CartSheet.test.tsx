import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import CartSheet, { type CartSheetProps } from './CartSheet';

let mockResolveRuntime: (() => void) | null = null;

jest.mock('next/dynamic', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { CheckoutTableGuestStateProvider } = jest.requireActual(
    '@/contexts/CheckoutTableGuestStateContext',
  ) as typeof import('@/contexts/CheckoutTableGuestStateContext');
  return {
    __esModule: true,
    default: (_loader: unknown, options?: { loading?: React.ComponentType }) =>
      function GuestRuntimeStub({
        children,
        readPublicTableGuestFeature,
      }: {
        readonly children: ReactNode;
        readonly readPublicTableGuestFeature: boolean;
      }) {
        const [isLoaded, setIsLoaded] = React.useState(false);
        React.useEffect(() => {
          mockResolveRuntime = () => setIsLoaded(true);
          return () => {
            mockResolveRuntime = null;
          };
        }, []);

        if (!readPublicTableGuestFeature) return children;

        if (!isLoaded) {
          const Loading = options?.loading;
          return Loading ? <Loading /> : null;
        }

        return (
          <CheckoutTableGuestStateProvider
            value={{ phase: 'active', hasPendingRound: false, hasAcknowledgement: false }}
          >
            {children}
          </CheckoutTableGuestStateProvider>
        );
      },
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

// The basket's contents (lines, totals, checkout) are covered by the checkout flows; this file
// pins the SHELL, whose presentation changed with the mcdoner mobile-fit fixes (2026-09-18).
jest.mock('@/components/design-system/BaseModal', () => ({
  __esModule: true,
  default: ({
    isOpen,
    title,
    presentation,
    children,
  }: {
    readonly isOpen: boolean;
    readonly title: string;
    readonly presentation: string;
    readonly children: ReactNode;
  }) =>
    isOpen ? (
      <section role="dialog" aria-label={title} data-presentation={presentation}>
        {children}
      </section>
    ) : null,
}));

jest.mock('./CartContents', () => {
  const { useCheckoutTableGuestState } = jest.requireActual(
    '@/contexts/CheckoutTableGuestStateContext',
  ) as typeof import('@/contexts/CheckoutTableGuestStateContext');
  return {
    __esModule: true,
    default: function CartContentsProbe() {
      const { phase } = useCheckoutTableGuestState();
      return (
        <output data-testid="cart-contents" aria-label="basket visit">
          {phase}
        </output>
      );
    },
  };
});

function renderCart() {
  const followUp = { pickType: jest.fn() } as unknown as CartSheetProps['followUp'];
  return render(<CartSheet isOpen onClose={jest.fn()} followUp={followUp} />);
}

describe('CartSheet shell', () => {
  beforeEach(() => {
    mockResolveRuntime = null;
  });

  it('opens its modal while the guest runtime loads, then provides admitted state to its contents', async () => {
    renderCart();

    const dialog = screen.getByRole('dialog', { name: 'Shopping Basket' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toContainElement(screen.getByText('Loading...'));
    expect(screen.queryByTestId('cart-contents')).not.toBeInTheDocument();

    await act(async () => {
      mockResolveRuntime?.();
    });

    const contents = screen.getByTestId('cart-contents');
    expect(contents).toHaveTextContent('active');
    expect(dialog).toContainElement(contents);
  });

  // The basket is a phone-first scrollable surface: it must take the shared docked sheet
  // (definite 90dvh height, BaseModal) rather than its own auto-height phone CSS, which WebKit
  // collapsed to a ~90px strip on real iOS Safari (2026-09-18 staging report).
  it('docks to the shared responsive bottom sheet on phones', () => {
    renderCart();

    expect(screen.getByRole('dialog')).toHaveAttribute('data-presentation', 'responsive-sheet');
  });
});
