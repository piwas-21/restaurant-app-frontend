/**
 * Order Service
 *
 * Barrel for the Order API service layer. The implementation is split by concern
 * under ./order/ (Sprint 4/6 service split — file-length §4); this module re-exports
 * the individual functions and the aggregate `orderService` object so existing
 * `@/services/orderService` imports keep working unchanged.
 */

export { buildQueryString } from './order/orderQuery';
export {
  createOrder,
  createOrderFromBasket,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  toggleFocusOrder,
} from './order/orderCommands';
export { getMyOrders, getOrders, getOrderById, getFocusOrders, getZReport } from './order/orderQueries';
export { addPaymentToOrder, refundPayment } from './order/orderPayments';

import {
  createOrder,
  createOrderFromBasket,
  updateOrderStatus,
  cancelOrder,
  toggleFocusOrder,
} from './order/orderCommands';
import { getMyOrders, getOrders, getOrderById, getFocusOrders, getZReport } from './order/orderQueries';
import { addPaymentToOrder, refundPayment } from './order/orderPayments';

/**
 * Order service object with all methods (mirrors the original; `deleteOrder` is a
 * named export only — it was never part of this aggregate object).
 */
export const orderService = {
  createOrder,
  createOrderFromBasket,
  getOrders,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  toggleFocusOrder,
  getFocusOrders,
  addPaymentToOrder,
  refundPayment,
  getZReport,
};
