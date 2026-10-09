import '@testing-library/jest-dom';
import type { ComponentType } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { UseCartContentsArgs } from '@/hooks/order/useCartContents';
import CartContents from './CartContents';
import CraftCartContents from '@/templates/craft/surfaces/CraftCartContents';

jest.mock('react-i18next', () => ({
  // CartLineList also reads the current language when rendering a variation summary.
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key, i18n: { language: 'en' } }),
}));

const mockHookValue = {
  items: [] as Array<Record<string, unknown>>,
  itemCount: 0,
  subtotal: 0,
  canCheckout: false,
  blockerMessage: '',
  isOrderTypeSelectionPending: false,
  isCheckoutPending: false,
  isChannelRecoveryVisible: false,
  isChannelRecoveryRetrying: false,
  channelRecoveryErrorMessage: null as string | null,
  retryChannelRecovery: jest.fn(),
  isSyncing: false,
  isResolving: false,
  handleQty: jest.fn(),
  handleRemove: jest.fn(),
  handleCheckout: jest.fn(),
  handlePick: jest.fn(),
  error: null as string | null,
};
jest.mock('@/hooks/order/useCartContents', () => ({ useCartContents: () => mockHookValue }));
jest.mock('@/components/order/OrderTypeToggleShell', () => ({
  __esModule: true,
  default: ({ disabled }: { disabled?: boolean }) => (
    <button type="button" data-testid="order-type-toggle" disabled={disabled}>
      Order type
    </button>
  ),
}));
jest.mock('@/components/order/OrderLineSummary', () => ({
  __esModule: true,
  default: () => <div data-testid="line-summary" />,
}));

const item = (over: Record<string, unknown> = {}) => ({
  basketItemId: 'b1',
  productName: 'Shakshuka',
  quantity: 2,
  itemTotal: 24,
  ...over,
});

const cartSurfaces: Array<{
  name: string;
  Component: ComponentType<Readonly<UseCartContentsArgs>>;
}> = [
  { name: 'classic', Component: CartContents },
  { name: 'craft', Component: CraftCartContents },
];

describe.each(cartSurfaces)('$name cart contents', ({ Component }) => {
  const renderSurface = () => render(<Component pickType={jest.fn()} />);

  beforeEach(() => {
    Object.assign(mockHookValue, {
      items: [],
      itemCount: 0,
      subtotal: 0,
      canCheckout: false,
      blockerMessage: '',
      isOrderTypeSelectionPending: false,
      isCheckoutPending: false,
      isChannelRecoveryVisible: false,
      isChannelRecoveryRetrying: false,
      channelRecoveryErrorMessage: null,
      retryChannelRecovery: jest.fn(),
      error: null,
      isResolving: false,
    });
  });

  it('renders cart mutation failures instead of silently losing an edited line', () => {
    Object.assign(mockHookValue, { error: 'Your shopping cart is empty or expired' });
    renderSurface();
    expect(screen.getByRole('alert')).toHaveTextContent('Your shopping cart is empty or expired');
  });

  it('renders no alert when there is no error', () => {
    renderSurface();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the channel recovery explanation and explicit retry', () => {
    const retryChannelRecovery = jest.fn();
    Object.assign(mockHookValue, {
      isChannelRecoveryVisible: true,
      channelRecoveryErrorMessage: 'The server could not confirm the selected order type.',
      retryChannelRecovery,
    });
    renderSurface();
    expect(screen.getByRole('alert')).toHaveTextContent('The server could not confirm the selected order type.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retryChannelRecovery).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state with its order-type toggle', () => {
    renderSurface();
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.getByTestId('order-type-toggle')).toBeInTheDocument();
  });

  it('renders each line name and the total', () => {
    Object.assign(mockHookValue, { items: [item()], subtotal: 24 });
    renderSurface();
    expect(screen.getByText('Shakshuka')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByTestId('line-summary')).toBeInTheDocument();
  });

  it('keeps the CTA live without an order type, then disables it during pending work', () => {
    const { rerender } = renderSurface();
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled();

    Object.assign(mockHookValue, { items: [item()], itemCount: 2, canCheckout: false });
    rerender(<Component pickType={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeEnabled();

    Object.assign(mockHookValue, { isOrderTypeSelectionPending: true });
    rerender(<Component pickType={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled();

    Object.assign(mockHookValue, { isOrderTypeSelectionPending: false, isCheckoutPending: true });
    rerender(<Component pickType={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled();
    expect(screen.getByTestId('order-type-toggle')).toBeDisabled();

    Object.assign(mockHookValue, { isCheckoutPending: false });
    rerender(<Component pickType={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeEnabled();
  });

  it('renders the blocker hint when checkout cannot proceed', () => {
    Object.assign(mockHookValue, { items: [item()], itemCount: 2, blockerMessage: 'Pick an order type' });
    renderSurface();
    expect(screen.getByRole('status')).toHaveTextContent('Pick an order type');
  });
});
