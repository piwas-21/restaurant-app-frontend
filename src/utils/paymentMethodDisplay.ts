/**
 * Payment Method Display Utilities
 *
 * Provides functions to get proper display names for payment methods
 */

import { PaymentMethod } from '@/types/order';
import { PAYMENT_METHODS } from '@/config/paymentMethods';

/**
 * Get the display label for a payment method
 * Handles both enum values and string representations
 * Maps backend numeric values (1-6) to frontend enum names
 */
export function getPaymentMethodLabel(method: string | PaymentMethod | number): string {
  if (!method && method !== 0) return 'Unknown';

  const methodStr = String(method);

  // Map backend numeric values to frontend enum names
  // Backend enum: Cash=1, CreditCard=2, DebitCard=3, OnlinePayment=4, MobilePayment=5, BankTransfer=6
  const numericToEnumName: Record<string, PaymentMethod> = {
    '1': PaymentMethod.Cash,
    '2': PaymentMethod.CreditCard,
    '3': PaymentMethod.DebitCard,
    '4': PaymentMethod.OnlinePayment,
    '5': PaymentMethod.MobilePayment,
    '6': PaymentMethod.BankTransfer,
  };

  // If method is a numeric string from backend, map it to enum name
  if (numericToEnumName[methodStr]) {
    const enumValue = numericToEnumName[methodStr];
    const paymentMethodConfig = PAYMENT_METHODS.find((pm) => pm.value === enumValue);
    if (paymentMethodConfig) {
      return paymentMethodConfig.label;
    }
  }

  // Find the matching payment method config by direct match
  const paymentMethodConfig = PAYMENT_METHODS.find(
    (pm) =>
      pm.value === method ||
      pm.value.toString() === methodStr ||
      pm.label === methodStr ||
      // Match by enum name
      (pm.value as unknown as string) === methodStr
  );

  return paymentMethodConfig?.label || (methodStr === '0' ? 'Unknown' : methodStr);
}

/**
 * Get a formatted payment method string for display
 * Includes the amount if provided
 */
export function formatPaymentMethod(
  method: string | PaymentMethod | number,
  amount?: number
): string {
  const label = getPaymentMethodLabel(method);
  if (amount !== undefined) {
    return `${label} - CHF ${amount.toFixed(2)}`;
  }
  return label;
}

/**
 * Get payment method name from enum value
 */
export function getPaymentMethodName(value: PaymentMethod): string {
  const mapping: Record<PaymentMethod, string> = {
    [PaymentMethod.Cash]: 'Cash',
    [PaymentMethod.CreditCard]: 'Credit Card',
    [PaymentMethod.DebitCard]: 'Debit Card',
    [PaymentMethod.OnlinePayment]: 'Online Payment',
    [PaymentMethod.MobilePayment]: 'Mobile Payment',
    [PaymentMethod.BankTransfer]: 'Bank Transfer',
  };
  return mapping[value] || 'Unknown';
}
