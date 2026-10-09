import type { AddPaymentRequest } from '@/services/cashierService';
import type { OrderDto, PaymentOperationLookupDto } from '@/types/order';
import type { CashierOrderGroupDto, CashierQueueState } from '@/types/cashier';
import type { ConnectionState } from './useCashierOrdersStream';

export interface UseCashierOrdersReturn {
  groups: CashierOrderGroupDto[];
  orders: OrderDto[];
  pagination: { totalCount: number; page: number; pageSize: number; totalPages: number };
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  queueState: CashierQueueState;
  lastEventTime: Date | null;
  connectionState: ConnectionState;
  refreshOrders: () => Promise<boolean>;
  updateOrderStatus: (orderId: string, status: string) => Promise<OrderDto>;
  addPayment: (orderId: string, paymentData: AddPaymentRequest) => Promise<OrderDto>;
  reconcilePayment: (orderId: string, operationId: string) => Promise<PaymentOperationLookupDto>;
  refundPayment: (orderId: string, paymentId: string, amount: number, reason: string) => Promise<OrderDto>;
  cancelOrder: (orderId: string, reason?: string) => Promise<OrderDto>;
  toggleFocusOrder: (orderId: string, isFocus: boolean, priority?: number, reason?: string) => Promise<OrderDto>;
}
