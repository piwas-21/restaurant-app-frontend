import type { BillChargeInput } from '@/types/billCharge';
import { billChargeInputSchema } from '@/schemas/billCharge.schema';
import { MAX_BILL_CHARGE_FIELDS } from '@/lib/billChargeLimits';

export function readBillChargeInputs(value: unknown): BillChargeInput[] | undefined {
  if (value === undefined) return undefined;
  return billChargeInputSchema.array().max(MAX_BILL_CHARGE_FIELDS).parse(value);
}
