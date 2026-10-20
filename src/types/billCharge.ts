import type { BillChargeRuleValues } from '@/schemas/billCharge.schema';

export type BillChargeRule = BillChargeRuleValues;
export interface BillChargeConfiguration {
  readonly currency: string | null;
  readonly rules: readonly BillChargeRule[];
}
export interface BillChargeInput {
  readonly key: string;
  readonly amount: number;
  readonly effect?: 'Increase' | 'Reduce';
  readonly calculation?: 'Fixed' | 'Percentage';
}
export interface BillCharge {
  readonly key: string;
  readonly label: string;
  readonly amount: number;
  readonly currency: string;
}

export interface OrderBillingFields {
  payableTotal?: number | null;
  billingCreditAmount?: number;
  billChargeAmount?: number;
  billChargeItemBasis?: number | null;
  hasPendingBillingCorrection?: boolean;
  billCharges?: readonly BillCharge[];
}
