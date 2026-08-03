import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import CartContents from './CartContents';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

const mockHookValue = {
  items: [] as Array<Record<string, unknown>>,
  itemCount: 0,
  subtotal: 0,
  canCheckout: false,
  blockerMessage: '',
  isSyncing: false,
  isResolving: false,
  handleQty: jest.fn(),
  handleRemove: jest.fn(),
  handleCheckout: jest.fn(),
  handlePick: jest.fn(),
};
jest.mock('@/hooks/order/useCartContents', () => ({ useCartContents: () => mockHookValue }));
jest.mock('./OrderTypeToggle', () => ({ __esModule: true, default: () => <div data-testid="order-type-toggle" /> }));
jest.mock('./OrderLineSummary', () => ({ __esModule: true, default: () => <div data-testid="line-summary" /> }));

const item = (over: Record<string, unknown> = {}) => ({
  basketItemId: 'b1',
  productName: 'Shakshuka',
  quantity: 2,
  itemTotal: 24,
  ...over,
});

describe('CartContents (classic)', () => {
  beforeEach(() => {
    Object.assign(mockHookValue, {
      items: [],
      itemCount: 0,
      subtotal: 0,
      canCheckout: false,
      blockerMessage: '',
      error: null,
      isResolving: false,
    });
  });

  // #415. This surface swallows the rethrow from handleQty/handleRemove, and until the fix it read
  // nothing from `error` — so on /menu, the page guests order from, a failed line edit showed
  // NOTHING and the cart just snapped back. Deleting this render brings that silence back, and only
  // the legacy /cart route would still say anything.
  it('renders the cart error, so a failed line edit is not silent', () => {
    Object.assign(mockHookValue, { error: 'Your shopping cart is empty or expired' });
    render(<CartContents pickType={jest.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Your shopping cart is empty or expired');
  });

  it('renders no alert when there is no error', () => {
    render(<CartContents pickType={jest.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the empty state + order-type toggle when the cart is empty', () => {
    render(<CartContents pickType={jest.fn()} />);
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.getByTestId('order-type-toggle')).toBeInTheDocument();
  });

  it('renders each line name and the total row', () => {
    Object.assign(mockHookValue, { items: [item()], subtotal: 24 });
    render(<CartContents pickType={jest.fn()} />);
    expect(screen.getByText('Shakshuka')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByTestId('line-summary')).toBeInTheDocument();
  });

  it('disables the checkout button only for an empty cart', () => {
    const { rerender } = render(<CartContents pickType={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled();

    // Items but no order type: still clickable, so the click can say why. A dead
    // disabled button with no explanation was the bug.
    Object.assign(mockHookValue, { items: [item()], itemCount: 2, canCheckout: false });
    rerender(<CartContents pickType={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeEnabled();
  });

  it('renders the blocker hint when the flow cannot proceed', () => {
    Object.assign(mockHookValue, { items: [item()], itemCount: 2, blockerMessage: 'Pick an order type' });
    render(<CartContents pickType={jest.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Pick an order type');
  });
});
