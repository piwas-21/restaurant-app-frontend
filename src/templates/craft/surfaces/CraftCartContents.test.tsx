import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import CraftCartContents from './CraftCartContents';

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
jest.mock('./CraftOrderTypeToggle', () => ({ __esModule: true, default: () => <div data-testid="craft-toggle" /> }));
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

describe('CraftCartContents', () => {
  beforeEach(() => {
    Object.assign(mockHookValue, {
      items: [],
      itemCount: 0,
      subtotal: 0,
      canCheckout: false,
      blockerMessage: '',
      error: null,
    });
  });

  // #415 — see the classic surface's copy of this. Both templates need the slot; a fix proven on
  // only one of them reaches whichever build the tenant does not ship.
  it('renders the cart error, so a failed line edit is not silent', () => {
    Object.assign(mockHookValue, { error: 'Your shopping cart is empty or expired' });
    render(<CraftCartContents pickType={jest.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Your shopping cart is empty or expired');
  });

  it('renders the craft empty note + order-type toggle', () => {
    render(<CraftCartContents pickType={jest.fn()} />);
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.getByTestId('craft-toggle')).toBeInTheDocument();
  });

  it('renders each dish name and the grand total', () => {
    Object.assign(mockHookValue, { items: [item()], subtotal: 24 });
    render(<CraftCartContents pickType={jest.fn()} />);
    expect(screen.getByText('Shakshuka')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByTestId('line-summary')).toBeInTheDocument();
  });

  it('disables the checkout CTA only for an empty cart', () => {
    render(<CraftCartContents pickType={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled();
  });

  it('keeps the CTA live without an order type, and prints the reason', () => {
    Object.assign(mockHookValue, { items: [item()], itemCount: 2, blockerMessage: 'Pick an order type' });
    render(<CraftCartContents pickType={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Pick an order type');
  });
});
