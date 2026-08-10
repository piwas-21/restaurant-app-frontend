/**
 * CheckoutReturnPanel — SOFRA-PAYMENTS-PLAN §5 S9.
 *
 * One property matters more than everything else here: **the "Order Received" success banner
 * appears only for a payment we can actually vouch for.** The confirmation page already had a
 * graceful fallback that renders that banner whenever an order number is in the URL — which is
 * exactly the shape a failed payment would have arrived in — so this is not a hypothetical risk,
 * it is the trap the panel exists to avoid falling into.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CheckoutReturnPanel from './CheckoutReturnPanel';
import type { CheckoutReturnOutcome } from '@/hooks/checkout/useCheckoutReturn';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush() }) }));
function mockPush() {
  return push;
}

const settlement = { orderNumber: 'A-001', paymentStatus: 'Completed', orderStatus: 'Confirmed' };

function renderPanel(outcome: CheckoutReturnOutcome, withSettlement = true) {
  return render(
    <CheckoutReturnPanel outcome={outcome} settlement={withSettlement ? settlement : null} orderId="order-1" />,
  );
}

describe('CheckoutReturnPanel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the success banner and the order number when paid', () => {
    renderPanel('paid');

    expect(screen.getByText('Order Received')).toBeInTheDocument();
    expect(screen.getByText('A-001')).toBeInTheDocument();
  });

  it.each<[CheckoutReturnOutcome]>([['settling'], ['cancelled'], ['pending'], ['unknown']])(
    'never shows the success banner on %s',
    (outcome) => {
      renderPanel(outcome);

      // The assertion the whole component exists for.
      expect(screen.queryByText('Order Received')).not.toBeInTheDocument();
    },
  );

  it('tells a cancelled diner nothing was charged and the basket survives', () => {
    renderPanel('cancelled');

    expect(screen.getByText('Payment not completed')).toBeInTheDocument();
    expect(screen.getByText(/Nothing has been charged/i)).toBeInTheDocument();
    expect(screen.getByText(/basket is still here/i)).toBeInTheDocument();
  });

  it.each<[CheckoutReturnOutcome, RegExp]>([
    ['pending', /being processed/i],
    ['unknown', /could not confirm your payment/i],
  ])('on %s it says so, and tells them NOT to pay again', (outcome, message) => {
    renderPanel(outcome);

    expect(screen.getByText('We are still confirming your payment')).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    // The line that stops a worried diner paying twice. Both branches must carry it.
    expect(screen.getByText(/do not (need to )?pay again/i)).toBeInTheDocument();
  });

  it('falls back to the cautious sentence when paid arrives with no settlement', () => {
    // `paid` without a settlement cannot render an order number, and a success banner without one
    // would be a claim with nothing behind it.
    renderPanel('paid', false);

    expect(screen.queryByText('Order Received')).not.toBeInTheDocument();
    expect(screen.getByText('We are still confirming your payment')).toBeInTheDocument();
  });

  it('sends "View order details" to the ordinary confirmation view, carrying the order number', () => {
    // WITHOUT `sessionId` (or it would re-enter this panel) and WITH `orderNumber` — that second
    // param is what lets a GUEST, who cannot read the auth-gated order endpoint, land on the
    // existing graceful fallback instead of an error.
    renderPanel('paid');

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    expect(push).toHaveBeenCalledWith('/checkout/confirmation?orderId=order-1&orderNumber=A-001');
    expect(push.mock.calls[0][0]).not.toContain('sessionId');
  });

  it('sends "Back to Menu" to the menu', () => {
    renderPanel('cancelled');

    fireEvent.click(screen.getByRole('button', { name: /back to menu/i }));

    expect(push).toHaveBeenCalledWith('/menu');
  });

  it('still links out when the URL carried no orderId', () => {
    // The order number comes from the settlement, not the URL, so the success view must not depend
    // on a query param that a hand-edited or truncated return URL can be missing.
    render(<CheckoutReturnPanel outcome="paid" settlement={settlement} orderId={null} />);

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    expect(push).toHaveBeenCalledWith('/checkout/confirmation?orderId=&orderNumber=A-001');
  });

  it('offers a way out of every terminal state', () => {
    for (const outcome of ['paid', 'cancelled', 'pending', 'unknown'] as CheckoutReturnOutcome[]) {
      const { unmount } = renderPanel(outcome);
      expect(screen.getByRole('button', { name: /back to menu/i })).toBeInTheDocument();
      unmount();
    }
  });
});
