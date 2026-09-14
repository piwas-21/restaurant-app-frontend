/**
 * Payment Method Display Utilities
 *
 * Provides functions to get proper display names for payment methods
 */

import { formatPlainCurrency } from '@/utils/currency';
import { PaymentMethod } from '@/types/order';
import { PAYMENT_METHODS } from '@/config/paymentMethods';

/** A minimal translator shape shared by UI components and HTML/PDF receipt builders. */
export type PaymentTranslationFunction = (key: string, fallback: string) => string;

/**
 * Get the localized display label for a payment method.
 * Handles backend numeric enum values and historical string aliases without exposing raw enum names.
 */
export function getPaymentMethodLabel(method: string | PaymentMethod | number, t?: PaymentTranslationFunction): string {
  if (!method && method !== 0) return 'Unknown';

  const methodStr = String(method);
  const normalizedMethod = methodStr.trim().toLowerCase();

  // Backend enum: Cash=1, CreditCard=2, DebitCard=3, OnlinePayment=4, MobilePayment=5, BankTransfer=6.
  const numericToEnumName: Record<string, PaymentMethod> = {
    '1': PaymentMethod.Cash,
    '2': PaymentMethod.CreditCard,
    '3': PaymentMethod.DebitCard,
    '4': PaymentMethod.OnlinePayment,
    '5': PaymentMethod.MobilePayment,
    '6': PaymentMethod.BankTransfer,
  };
  const enumValue = numericToEnumName[methodStr.trim()];

  // `Card` is the legacy generic value used by older receipts; CreditCard is now explicitly the
  // card-at-restaurant intent. Normalizing also keeps casing/whitespace changes from printing raw
  // backend values in a customer or cashier surface.
  const paymentMethodConfig = PAYMENT_METHODS.find((pm) => {
    const configValue = pm.value.toLowerCase();
    const configLabel = pm.label.toLowerCase();
    return (
      pm.value === enumValue ||
      configValue === normalizedMethod ||
      configLabel === normalizedMethod ||
      (normalizedMethod === 'card' && pm.value === PaymentMethod.CreditCard)
    );
  });

  if (paymentMethodConfig) {
    return t ? t(paymentMethodConfig.labelKey, paymentMethodConfig.label) : paymentMethodConfig.label;
  }

  return normalizedMethod === '0' ? 'Unknown' : methodStr;
}

/**
 * Get a formatted payment method string for display
 * Includes the amount if provided
 */
export function formatPaymentMethod(method: string | PaymentMethod | number, amount?: number): string {
  const label = getPaymentMethodLabel(method);
  if (amount !== undefined) {
    return `${label} - ${formatPlainCurrency(amount)}`;
  }
  return label;
}

/**
 * Get payment method name from enum value
 */
export function getPaymentMethodName(value: PaymentMethod): string {
  return getPaymentMethodLabel(value);
}
