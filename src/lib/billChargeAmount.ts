import { billChargeAmountSchema } from '@/schemas/billCharge.schema';

/** Keep text editing separate from the numeric API contract, including a cleared field. */
export function parseBillChargeAmount(text: string): number | null {
  const normalized = text.replace(',', '.');
  if (normalized === '' || normalized === '.') return 0;
  if (!/^\d*(?:\.\d{0,2})?$/.test(normalized)) return null;
  const amount = billChargeAmountSchema.safeParse(Number(normalized));
  return amount.success ? amount.data : null;
}
