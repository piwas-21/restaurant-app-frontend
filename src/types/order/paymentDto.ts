import { PaymentMethod, PaymentRecordStatus } from './enums';

/** Payment read shape, distinct from the narrower guest-order payment intent. */
export interface OrderPaymentDto {
  operationId?: string | null;
  paymentMethod: PaymentMethod;
  amount: number;
  /** Cashier-collected gratuity in exact minor units, separate from food amount. */
  tipMinor?: number;
  paymentNotes?: string;
  transactionId?: string;
  referenceNumber?: string;
  cardLastFourDigits?: string;
  cardType?: string;
  paymentGateway?: string;
  id: string;
  orderId: string;
  status: PaymentRecordStatus;
  paymentDate?: string;
  isRefunded?: boolean;
  refundedAmount?: number;
  /** Cashier-refunded gratuity in exact minor units. */
  refundedTipMinor?: number;
  refundDate?: string;
  refundReason?: string;
  createdAt?: string;
}
