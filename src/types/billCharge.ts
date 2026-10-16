export interface BillChargeRule {
  readonly key: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly defaultAmount: number;
  readonly allowCustomAmount: boolean;
  readonly orderTypes: readonly string[];
  readonly roles: readonly string[];
}
export interface BillChargeConfiguration {
  readonly currency: string | null;
  readonly rules: readonly BillChargeRule[];
}
export interface BillChargeInput {
  readonly key: string;
  readonly amount: number;
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
  billCharges?: readonly BillCharge[];
}
