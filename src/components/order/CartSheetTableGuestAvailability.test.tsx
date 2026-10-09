import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import CartSheet from './CartSheet';
import { TableContextProvider } from '@/contexts/TableContext';
import type { TableGuestVisitPhase } from '@/types/tableGuestVisit';
import { OrderType } from '@/types/order';

const mockProceedToCheckout = jest.fn();
let mockPhase: TableGuestVisitPhase = 'active';
let mockBlockerMessageKey: string | null = 'table_guest_dine_in_unavailable';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default:
    () =>
    ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/design-system/BaseModal', () => ({
  __esModule: true,
  default: ({
    isOpen,
    title,
    children,
  }: {
    readonly isOpen: boolean;
    readonly title: string;
    readonly children: React.ReactNode;
  }) =>
    isOpen ? (
      <section role="dialog" aria-label={title}>
        {children}
      </section>
    ) : null,
}));

jest.mock('@/components/cart/CartContext', () => ({
  useCart: () => ({
    state: {
      items: [{ basketItemId: 'basket-item', productName: 'Soup', quantity: 1, itemTotal: 5 }],
      isSyncing: false,
      error: null,
    },
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    clearError: jest.fn(),
  }),
}));

jest.mock('@/contexts/OrderTypeContext', () => ({
  useOrderType: () => ({ state: { orderType: 'DineIn' }, hasChosenOrderType: true }),
}));

jest.mock('@/contexts/CheckoutContext', () => ({
  useCheckout: () => ({ state: { customerInfo: null, deliveryAddress: null } }),
}));

jest.mock('@/hooks/checkout/useSmartCheckoutRouter', () => ({
  useSmartCheckoutRouter: () => ({ proceedToCheckout: mockProceedToCheckout, isResolving: false }),
}));

jest.mock('@/hooks/checkout/useTableGuestDineInAvailability', () => ({
  useTableGuestDineInAvailability: () => ({
    phase: mockPhase,
    visitBound: true,
    active: mockPhase === 'active',
    dineInAvailable: false,
    blocked: true,
    blockerMessageKey: mockBlockerMessageKey,
    dineInUnavailable: mockPhase === 'active',
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => {
      const copy: Record<string, string> = {
        table_guest_dine_in_unavailable:
          'Dine-in is not available for this table visit right now. Your basket and visit remain saved in this tab.',
        table_guest_ended_detail: 'Ask staff to start or confirm a visit before ordering again.',
        table_guest_storage_help: 'This browser cannot safely keep a table visit for this tab.',
        table_guest_unavailable_detail: 'Ask staff to confirm whether table visits are available.',
      };
      return copy[key] ?? (typeof fallback === 'string' ? fallback : key);
    },
  }),
}));

jest.mock('./OrderTypeToggle', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./CartLineList', () => ({
  __esModule: true,
  default: () => <div>Cart lines</div>,
}));

function CartSheetHarness() {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <TableContextProvider>
      <CartSheet isOpen={isOpen} onClose={() => setIsOpen(false)} followUp={{ pickType: jest.fn() } as never} />
    </TableContextProvider>
  );
}

describe('CartSheet table-guest availability', () => {
  beforeEach(() => {
    mockPhase = 'active';
    mockBlockerMessageKey = 'table_guest_dine_in_unavailable';
    mockProceedToCheckout.mockReset();
    mockProceedToCheckout.mockResolvedValue('table-guest-unavailable');
  });

  it('keeps the mounted sheet open and shows the blocker when routing refuses an active visit', async () => {
    render(<CartSheetHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Proceed to Checkout' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Dine-in is not available for this table visit right now. Your basket and visit remain saved in this tab.',
    );
    expect(screen.getByRole('dialog', { name: 'Shopping Basket' })).toBeInTheDocument();
    expect(screen.getByText('Cart lines')).toBeInTheDocument();
    await waitFor(() => expect(mockProceedToCheckout).toHaveBeenCalledWith(OrderType.DineIn, 'cart_sheet'));
  });

  it.each([
    ['ended', 'table_guest_ended_detail', 'Ask staff to start or confirm a visit before ordering again.'],
    ['storageUnavailable', 'table_guest_storage_help', 'This browser cannot safely keep a table visit for this tab.'],
  ] as const)('shows phase-specific copy for a %s visit', (phase, messageKey, expectedCopy) => {
    mockPhase = phase;
    mockBlockerMessageKey = messageKey;

    render(<CartSheetHarness />);

    expect(screen.getByRole('status')).toHaveTextContent(expectedCopy);
    expect(screen.getByRole('dialog', { name: 'Shopping Basket' })).toBeInTheDocument();
  });
});
