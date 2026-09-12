/**
 * Staff payment-operation reconciliation response.
 *
 * The operation key identifies one add-payment attempt. A lookup is deliberately separate from
 * payment status: `Committed` means this operation's tender is on the requested order, while
 * `Unknown` means the server found no matching tender (and is still a successful lookup).
 */

import type { ApiResponse } from './common';
import type { OrderDto } from './orderDto';
import type { OrderPaymentDto } from './dtos';

export type PaymentOperationLookupStatus = 'Committed' | 'Unknown';

export interface PaymentOperationLookupDto {
  operationId: string;
  status: PaymentOperationLookupStatus;
  payment: OrderPaymentDto | null;
  order: OrderDto | null;
}

export type PaymentOperationLookupApiResponse = ApiResponse<PaymentOperationLookupDto>;
