import type { AccountPaymentSummaryMethod } from './accountPayments';

export interface AccountCashSettlement {
  policyVersion: 'chf-cash-5-rappen-v1' | 'exact-v1';
  currency: string;
  paymentMethod: AccountPaymentSummaryMethod;
  exactAmountMinor: number;
  adjustmentMinor: number;
  dueAmountMinor: number;
}

export interface AccountCashReceipt {
  policyVersion: AccountCashSettlement['policyVersion'];
  currency: string;
  exactAmountMinor: number;
  adjustmentMinor: number;
  dueAmountMinor: number;
  receivedMinor: number;
  changeMinor: number;
  capturedAt: string;
}

export interface CaptureAccountPaymentRequest {
  expectedVersion: number;
  receivedMinor?: number;
}
