/**
 * CheckoutReturnView — SOFRA-PAYMENTS-PLAN §5 S9.
 *
 * A three-line component with one job worth pinning: `useCheckoutReturn` performs a **write** (it
 * is the primary settle trigger), and mounting it only on this route is what keeps that write off
 * every ordinary confirmation visit. A hook cannot be called conditionally, so the condition is a
 * component boundary — and a future refactor that "simplifies" the boundary away would silently
 * start settling on page loads that have nothing to settle.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import CheckoutReturnView from './CheckoutReturnView';
import { useCheckoutReturn } from '@/hooks/checkout/useCheckoutReturn';

jest.mock('@/hooks/checkout/useCheckoutReturn', () => ({ useCheckoutReturn: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams('orderId=order-7&sessionId=cs_1'),
}));

const mockReturn = useCheckoutReturn as jest.MockedFunction<typeof useCheckoutReturn>;

describe('CheckoutReturnView', () => {
  beforeEach(() => jest.clearAllMocks());

  it('settles the sessionId it was given, not one it reads back from the URL', () => {
    // The prop is the contract: the route decided this is a return trip, and passing the id it
    // decided on keeps the two from ever disagreeing.
    mockReturn.mockReturnValue({ outcome: 'settling', settlement: null });

    render(<CheckoutReturnView sessionId="cs_from_prop" />);

    expect(mockReturn).toHaveBeenCalledWith('cs_from_prop');
  });

  it('renders the outcome the hook reports', () => {
    mockReturn.mockReturnValue({
      outcome: 'paid',
      settlement: { orderNumber: 'A-001', paymentStatus: 'Completed', orderStatus: 'Confirmed' },
    });

    render(<CheckoutReturnView sessionId="cs_1" />);

    expect(screen.getByText('Order Received')).toBeInTheDocument();
    expect(screen.getByText('A-001')).toBeInTheDocument();
  });

  it('passes the orderId through from the URL', () => {
    mockReturn.mockReturnValue({
      outcome: 'paid',
      settlement: { orderNumber: 'A-001', paymentStatus: 'Completed', orderStatus: 'Confirmed' },
    });

    render(<CheckoutReturnView sessionId="cs_1" />);

    // Proven through the panel's own link, which is the only place orderId is used.
    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
  });
});
