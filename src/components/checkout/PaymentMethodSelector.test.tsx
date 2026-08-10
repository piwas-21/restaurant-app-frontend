/**
 * PaymentMethodSelector + `offerablePaymentMethods` — SOFRA-PAYMENTS-PLAN §5 S8.
 *
 * The component had no test before this slice. It gets one now because the slice gives it a
 * branch that decides whether a diner is offered a way to pay that the restaurant cannot take,
 * and because the default matters as much as the branch: a caller that has not been taught to
 * pass `onlinePaymentAvailable` must get the pre-S8 behaviour, not an offer.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import PaymentMethodSelector from './PaymentMethodSelector';
import { offerablePaymentMethods, PAYMENT_METHODS } from '@/config/paymentMethods';
import { PaymentMethod } from '@/types/order';

jest.mock('react-i18next', () => ({
  // Return the DEFAULT, which is the real English copy — so an assertion reads the sentence a
  // diner sees rather than a key name. `t` is stable per render (it is a module-level identity
  // here), which is what the hook-dependency assumptions elsewhere expect.
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

describe('offerablePaymentMethods', () => {
  it('omits online payment entirely when it is unavailable', () => {
    const values = offerablePaymentMethods(false).map((method) => method.value);

    expect(values).not.toContain(PaymentMethod.OnlinePayment);
    // The other placeholders stay — "coming soon" is true of them, and hiding them is not this
    // slice's business.
    expect(values).toContain(PaymentMethod.CreditCard);
    expect(values).toContain(PaymentMethod.Cash);
  });

  it('includes online payment ENABLED when it is available', () => {
    const online = offerablePaymentMethods(true).find((m) => m.value === PaymentMethod.OnlinePayment);

    expect(online).toBeDefined();
    expect(online?.disabled).toBe(false);
  });

  it('does not mutate the shared catalog when enabling', () => {
    // Reads the MODULE-LEVEL array directly, which is the only assertion that can fail against an
    // in-place `forEach` flip. An earlier version of this test checked CreditCard's flag on the
    // RETURNED list — a member the function never touches on either branch — so it passed against
    // a mutating implementation. Measured, not reasoned: the reviewer ran that implementation
    // against the old assertions and all three stayed green.
    offerablePaymentMethods(true);

    const catalogEntry = PAYMENT_METHODS.find((m) => m.value === PaymentMethod.OnlinePayment);
    expect(catalogEntry?.disabled).toBe(true);
  });
});

describe('PaymentMethodSelector', () => {
  const noop = () => {};

  it('offers online payment, and states what the restaurant takes, when it is available', () => {
    render(<PaymentMethodSelector selectedMethod={PaymentMethod.Cash} onMethodChange={noop} onlinePaymentAvailable />);

    const online = screen.getByRole('radio', { name: /online payment/i });
    expect(online).toBeEnabled();
    expect(screen.getByText(/pay by card now/i)).toBeInTheDocument();
    expect(screen.queryByText(/only cash payment is available/i)).not.toBeInTheDocument();
  });

  it('does not render it at all when it is unavailable', () => {
    render(
      <PaymentMethodSelector
        selectedMethod={PaymentMethod.Cash}
        onMethodChange={noop}
        onlinePaymentAvailable={false}
      />,
    );

    expect(screen.queryByRole('radio', { name: /online payment/i })).not.toBeInTheDocument();
    expect(screen.getByText(/only cash payment is available/i)).toBeInTheDocument();
  });

  it('defaults to unavailable when the prop is omitted', () => {
    // The fail-closed default. A template or test that renders this component without asking the
    // backend must not offer a redirect the tenant cannot mint.
    render(<PaymentMethodSelector selectedMethod={PaymentMethod.Cash} onMethodChange={noop} />);

    expect(screen.queryByRole('radio', { name: /online payment/i })).not.toBeInTheDocument();
  });
});
