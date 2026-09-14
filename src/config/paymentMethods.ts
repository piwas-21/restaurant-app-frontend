/**
 * Payment Methods Configuration
 *
 * Defines available payment methods and their properties
 */

import { CreditCard, Wallet, Smartphone, Banknote, Building2 } from 'lucide-react';
import { OrderType, PaymentMethod } from '@/types/order';
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
 * {@link offerablePaymentMethods}, which is what the checkout page must render. CreditCard is
 * presented as an on-site intent, not as the optional Stripe OnlinePayment method.
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
    labelKey: 'payment_card_at_restaurant',
    label: 'Card at restaurant',
    icon: CreditCard,
    descriptionKey: 'payment_card_at_restaurant_desc',
    description: 'Pay by card at the restaurant',
    disabled: false,
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
 * deliberate departure from its four neighbours.** Card at restaurant is an on-site intent and
 * is available for DineIn and Takeaway, but not Delivery. Debit card, mobile payment and bank
 * transfer are placeholders for work
 * nobody has started; "coming soon" is true of them.
 * Online payment is a purchasable module — on a tenant that did not buy it, "coming soon"
 * promises something that will never arrive unless they pay for it, and the codebase's own rule
 * for an unbought module is that its surface does not exist on this instance (the backend
 * answers 404, not 403, for exactly that reason).
 */
export function normalizePaymentMethodForOrderType(method: PaymentMethod, orderType: OrderType | null): PaymentMethod {
  // Card at restaurant is a till intent. Only explicit DineIn/Takeaway channels have a
  // collection point, so Delivery, null and unknown states all fall back to Cash.
  const cardAllowed = orderType === OrderType.DineIn || orderType === OrderType.Takeaway;
  return !cardAllowed && method === PaymentMethod.CreditCard ? PaymentMethod.Cash : method;
}

export function offerablePaymentMethods(
  onlinePaymentAvailable: boolean,
  orderType: OrderType | null,
): PaymentMethodOption[] {
  // Checkout offers cash for every channel, but Card at restaurant only where a diner can hand
  // the tender to staff. The remaining non-online entries are future placeholders and stay hidden.
  const onSiteMethods = PAYMENT_METHODS.filter(
    (method) =>
      method.value === PaymentMethod.Cash ||
      ((orderType === OrderType.DineIn || orderType === OrderType.Takeaway) &&
        method.value === PaymentMethod.CreditCard),
  );

  if (!onlinePaymentAvailable) return onSiteMethods;

  // A copy, never a mutation of the shared catalog. The module-level catalog remains disabled for
  // OnlinePayment so a later fail-closed call cannot accidentally expose the Stripe path.
  const onlinePayment = PAYMENT_METHODS.find((method) => method.value === PaymentMethod.OnlinePayment);
  return onlinePayment ? [...onSiteMethods, { ...onlinePayment, disabled: false }] : onSiteMethods;
}
