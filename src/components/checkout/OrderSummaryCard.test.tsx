import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderSummaryCard from './OrderSummaryCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const baseProps = {
  basket: { subTotal: 20, total: 22 },
  taxConfig: null,
  taxAmount: 2,
  pointsDiscount: 0,
  redeemedPoints: 0,
  tipAmount: 0,
  isSubmitting: false,
  submitError: '',
  formatPrice: (n: number) => `$${n.toFixed(2)}`,
  formatTotal: (n: number) => `$${n.toFixed(2)}`,
  onPlaceOrder: jest.fn(),
};

describe('OrderSummaryCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the tax row and places the order', () => {
    const onPlaceOrder = jest.fn();
    render(<OrderSummaryCard {...baseProps} onPlaceOrder={onPlaceOrder} />);

    expect(screen.getByText('Tax')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(onPlaceOrder).toHaveBeenCalledTimes(1);
  });

  it('shows the submit error note and disables the buttons while submitting', () => {
    render(<OrderSummaryCard {...baseProps} isSubmitting submitError="Something went wrong" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /placing order/i })).toBeDisabled();
  });

  it('applies the active-template styles bundle (T4 re-skin)', () => {
    // identity-obj-proxy maps the default module to key-named classes; passing an
    // explicit bundle proves the craft/classic module threads through unchanged.
    const craftStyles = { summaryCard: 'craft-card', placeOrderButton: 'craft-pill' } as Record<string, string>;
    const { container } = render(<OrderSummaryCard {...baseProps} styles={craftStyles} />);

    expect(container.querySelector('.craft-card')).toBeInTheDocument();
    expect(container.querySelector('.craft-pill')).toBeInTheDocument();
  });
});
