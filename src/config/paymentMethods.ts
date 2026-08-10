/**
 * Payment Methods Configuration
 *
 * Defines available payment methods and their properties
 */

import { CreditCard, Wallet, Smartphone, Banknote, Building2 } from 'lucide-react';
import { PaymentMethod } from '@/types/order';
import type { LucideIcon } from 'lucide-react';

export interface PaymentMethodOption {
  value: PaymentMethod;
  labelKey: string;
  label: string;
  icon: LucideIcon;
  descriptionKey: string;
  description: string;
  disabled: boolean;
}

/**
 * The full payment-method vocabulary. `disabled` here is the *default* — see
 * {@link offerablePaymentMethods}, which is what the checkout page must render.
 */
export const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    value: PaymentMethod.Cash,
    labelKey: 'payment_cash',
    label: 'Cash',
    icon: Banknote,
    descriptionKey: 'payment_cash_desc',
    description: 'Pay on cashier',
    disabled: false,
  },
  {
    value: PaymentMethod.CreditCard,
    labelKey: 'payment_credit_card',
    label: 'Credit Card',
    icon: CreditCard,
    descriptionKey: 'payment_credit_card_desc',
    description: 'Visa, Mastercard, Amex',
    disabled: true,
  },
  {
    value: PaymentMethod.DebitCard,
    labelKey: 'payment_debit_card',
    label: 'Debit Card',
    icon: Wallet,
    descriptionKey: 'payment_debit_card_desc',
    description: 'EC/Maestro card',
    disabled: true,
  },
  {
    value: PaymentMethod.MobilePayment,
    labelKey: 'payment_mobile',
    label: 'Mobile Payment',
    icon: Smartphone,
    descriptionKey: 'payment_mobile_desc',
    description: 'TWINT, Apple Pay, Google Pay',
    disabled: true,
  },
  {
    value: PaymentMethod.OnlinePayment,
    labelKey: 'payment_online',
    label: 'Online Payment',
    icon: CreditCard,
    descriptionKey: 'payment_online_desc',
    description: 'Pay securely online',
    disabled: true,
  },
  {
    value: PaymentMethod.BankTransfer,
    labelKey: 'payment_bank_transfer',
    label: 'Bank Transfer',
    icon: Building2,
    descriptionKey: 'payment_bank_transfer_desc',
    description: 'Transfer to our account',
    disabled: true,
  },
];

/**
 * The methods a checkout page may actually show, given whether this restaurant can take an
 * online payment (SOFRA-PAYMENTS-PLAN §5 S8 — the answer comes from
 * `GET /api/payments/availability`, which fails closed).
 *
 * **Online payment is HIDDEN when unavailable rather than shown "Coming Soon", and that is a
 * deliberate departure from its four neighbours.** Credit card, debit card, mobile payment and
 * bank transfer are placeholders for work nobody has started; "coming soon" is true of them.
 * Online payment is a purchasable module — on a tenant that did not buy it, "coming soon"
 * promises something that will never arrive unless they pay for it, and the codebase's own rule
 * for an unbought module is that its surface does not exist on this instance (the backend
 * answers 404, not 403, for exactly that reason).
 */
export function offerablePaymentMethods(onlinePaymentAvailable: boolean): PaymentMethodOption[] {
  if (!onlinePaymentAvailable) {
    return PAYMENT_METHODS.filter((method) => method.value !== PaymentMethod.OnlinePayment);
  }

  // A copy, never a mutation of the shared catalog. The justification here first named
  // `paymentMethodDisplay` as the victim of an in-place flip — that was WRONG, it reads only
  // `.label` and never `.disabled`. The real reason is plainer and does not depend on today's
  // consumers: `PAYMENT_METHODS` is module-level mutable state, so flipping a flag in it makes
  // one call to this function change what every LATER call returns, including calls that pass
  // `false`. That is a bug no test of this function's return value would show.
  return PAYMENT_METHODS.map((method) =>
    method.value === PaymentMethod.OnlinePayment ? { ...method, disabled: false } : method,
  );
}
