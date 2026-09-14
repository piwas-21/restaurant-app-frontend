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
import { normalizePaymentMethodForOrderType, offerablePaymentMethods, PAYMENT_METHODS } from '@/config/paymentMethods';
import { OrderType, PaymentMethod } from '@/types/order';

jest.mock('react-i18next', () => ({
  // Return the DEFAULT, which is the real English copy — so an assertion reads the sentence a
  // diner sees rather than a key name. `t` is stable per render (it is a module-level identity
  // here), which is what the hook-dependency assumptions elsewhere expect.
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

describe('offerablePaymentMethods', () => {
  it('omits online payment entirely when it is unavailable', () => {
    const values = offerablePaymentMethods(false, OrderType.Takeaway).map((method) => method.value);

    expect(values).not.toContain(PaymentMethod.OnlinePayment);
    // The two on-site intents remain; every unsupported placeholder stays hidden.
    expect(values).toEqual([PaymentMethod.Cash, PaymentMethod.CreditCard]);
    expect(values).not.toContain(PaymentMethod.DebitCard);
  });

  it('includes online payment ENABLED without exposing the debit-card placeholder', () => {
    const values = offerablePaymentMethods(true, OrderType.Takeaway).map((method) => method.value);
    const online = offerablePaymentMethods(true, OrderType.Takeaway).find(
      (m) => m.value === PaymentMethod.OnlinePayment,
    );

    expect(online).toBeDefined();
    expect(online?.disabled).toBe(false);
    expect(values).toEqual([PaymentMethod.Cash, PaymentMethod.CreditCard, PaymentMethod.OnlinePayment]);
    expect(values).not.toContain(PaymentMethod.DebitCard);
  });

  it('does not mutate the shared catalog when enabling', () => {
    // Reads the MODULE-LEVEL array directly, which is the only assertion that can fail against an
    // in-place `forEach` flip. An earlier version of this test checked CreditCard's flag on the
    // RETURNED list — a member the function never touches on either branch — so it passed against
    // a mutating implementation. Measured, not reasoned: the reviewer ran that implementation
    // against the old assertions and all three stayed green.
    offerablePaymentMethods(true, OrderType.Takeaway);

    const catalogEntry = PAYMENT_METHODS.find((m) => m.value === PaymentMethod.OnlinePayment);
    expect(catalogEntry?.disabled).toBe(true);
  });
});

describe('Order-type payment method rules', () => {
  it('removes Card at restaurant when the selected channel changes to Delivery', () => {
    expect(normalizePaymentMethodForOrderType(PaymentMethod.CreditCard, OrderType.Delivery)).toBe(PaymentMethod.Cash);
    expect(normalizePaymentMethodForOrderType(PaymentMethod.CreditCard, OrderType.Takeaway)).toBe(
      PaymentMethod.CreditCard,
    );
    expect(normalizePaymentMethodForOrderType(PaymentMethod.CreditCard, null)).toBe(PaymentMethod.Cash);
  });

  it('fails closed for an unknown order type', () => {
    expect(offerablePaymentMethods(false, null).map((method) => method.value)).toEqual([PaymentMethod.Cash]);
    expect(offerablePaymentMethods(true, null).map((method) => method.value)).toEqual([
      PaymentMethod.Cash,
      PaymentMethod.OnlinePayment,
    ]);
  });

  it('hides Card at restaurant for Delivery with online payment unavailable', () => {
    expect(offerablePaymentMethods(false, OrderType.Delivery).map((method) => method.value)).toEqual([
      PaymentMethod.Cash,
    ]);
  });

  it('hides Card at restaurant for Delivery but keeps online payment when available', () => {
    expect(offerablePaymentMethods(true, OrderType.Delivery).map((method) => method.value)).toEqual([
      PaymentMethod.Cash,
      PaymentMethod.OnlinePayment,
    ]);
  });
});

describe('PaymentMethodSelector', () => {
  const noop = () => {};

  it('offers online payment, and states what the restaurant takes, when it is available', () => {
    render(
      <PaymentMethodSelector
        selectedMethod={PaymentMethod.Cash}
        onMethodChange={noop}
        orderType={OrderType.Takeaway}
        onlinePaymentAvailable
      />,
    );

    const online = screen.getByRole('radio', { name: /online payment/i });
    expect(online).toBeEnabled();
    expect(screen.getByRole('radio', { name: /card at restaurant/i })).toBeEnabled();
    expect(screen.queryByRole('radio', { name: /debit card/i })).not.toBeInTheDocument();
    expect(screen.getByText(/pay in cash or by card at the restaurant/i)).toBeInTheDocument();
    expect(screen.getByText(/pay by card now/i)).toBeInTheDocument();
    expect(screen.queryByText(/only cash payment is available/i)).not.toBeInTheDocument();
  });

  it('does not render it at all when it is unavailable', () => {
    render(
      <PaymentMethodSelector
        selectedMethod={PaymentMethod.Cash}
        onMethodChange={noop}
        orderType={OrderType.Takeaway}
        onlinePaymentAvailable={false}
      />,
    );

    expect(screen.queryByRole('radio', { name: /online payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /debit card/i })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /card at restaurant/i })).toBeEnabled();
    expect(screen.getByText(/pay in cash or by card at the restaurant/i)).toBeInTheDocument();
  });

  it('renders Cash when Delivery arrives with a stale card selection', () => {
    render(
      <PaymentMethodSelector
        selectedMethod={PaymentMethod.CreditCard}
        onMethodChange={noop}
        orderType={OrderType.Delivery}
        onlinePaymentAvailable
      />,
    );

    expect(screen.queryByRole('radio', { name: /card at restaurant/i })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /cash/i })).toBeChecked();
  });

  it('defaults to unavailable when the prop is omitted', () => {
    // The fail-closed default. A template or test that renders this component without asking the
    // backend must not offer a redirect the tenant cannot mint.
    render(
      <PaymentMethodSelector
        selectedMethod={PaymentMethod.Cash}
        onMethodChange={noop}
        orderType={OrderType.Takeaway}
      />,
    );

    expect(screen.queryByRole('radio', { name: /online payment/i })).not.toBeInTheDocument();
  });
});
