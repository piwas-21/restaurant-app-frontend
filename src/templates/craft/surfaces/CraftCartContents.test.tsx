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
    Object.assign(mockHookValue, { items: [], subtotal: 0, canCheckout: false });
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

  it('gates the checkout CTA on canCheckout', () => {
    Object.assign(mockHookValue, { items: [item()], canCheckout: false });
    render(<CraftCartContents pickType={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled();
  });
});
