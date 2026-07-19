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
    Object.assign(mockHookValue, { items: [], subtotal: 0, canCheckout: false, isResolving: false });
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

  it('gates the checkout button on canCheckout', () => {
    Object.assign(mockHookValue, { items: [item()], canCheckout: false });
    const { rerender } = render(<CartContents pickType={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled();
    Object.assign(mockHookValue, { canCheckout: true });
    rerender(<CartContents pickType={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeEnabled();
  });
});
