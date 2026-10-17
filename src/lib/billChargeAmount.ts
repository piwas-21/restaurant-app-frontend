import { MAX_BILL_CHARGE_AMOUNT } from './billChargeLimits';

/** Keep text editing separate from the numeric API contract, including a cleared field. */
export function parseBillChargeAmount(text: string): number | null {
  const normalized = text.replace(',', '.');
  if (normalized === '' || normalized === '.') return 0;
  if (!/^\d*(?:\.\d{0,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount <= MAX_BILL_CHARGE_AMOUNT ? amount : null;
}
