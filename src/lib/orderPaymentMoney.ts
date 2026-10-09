import { parseAccountContributionMinor } from '@/lib/accountPaymentMoney';

/** Keep cashier tips within the decimal(10,2) tender ceiling used by the backend. */
export const MAX_ORDER_TIP_MINOR = 9_999_999_999;

export function parseOrderTipMinor(input: string, currency: string): number | null {
  const minor = parseAccountContributionMinor(input, currency);
  return minor !== null && minor <= MAX_ORDER_TIP_MINOR ? minor : null;
}

export function orderTenderTotalMinor(foodAmount: string, tipAmount: string, currency: string): number | null {
  const foodMinor = parseAccountContributionMinor(foodAmount || '0', currency);
  const tipMinor = parseOrderTipMinor(tipAmount || '0', currency);
  if (foodMinor === null || tipMinor === null || foodMinor + tipMinor > Number.MAX_SAFE_INTEGER) return null;
  return foodMinor + tipMinor;
}

export function amountFromMinor(minor: number): number {
  return Number.isSafeInteger(minor) && minor >= 0 ? minor / 100 : 0;
}

export function inputFromMinor(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0) return '0.00';
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  return `${whole}.${fraction.toString().padStart(2, '0')}`;
}
