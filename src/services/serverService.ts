/**
 * Server Service — public re-exports of the server-flow API surface.
 *
 * The implementation has been split by resource under `./server/`:
 *   - orders.ts     — dine-in order CRUD
 *   - tables.ts     — table status + open/close/release (+ today's reservations
 *                     used internally by `getTablesWithStatus`)
 *   - menu.ts       — products + categories
 *   - customers.ts  — user search, fidelity, discount rules, point math
 *
 * This file is a stable barrel: existing call-sites import from
 * `@/services/serverService` and still resolve to the same names.
 */

export type { ServerTableDto } from './server/tables';
export type { Product, ProductCategoryLink, ProductVariation, Category } from './server/menu';
export type { UserDto, FidelityPointBalanceDto, CustomerDiscountRuleDto } from './server/customers';

export {
  getDineInOrders,
  updateOrderStatus,
  markOrderCompleted,
  completeAllTableOrders,
  getOrderById,
  getOrdersForTable,
  createServerOrder,
} from './server/orders';
export {
  getTables,
  getTablesWithStatus,
  getUpcomingReservations,
  closeTable,
  openTable,
  releaseTable,
} from './server/tables';
export { getMenuProducts, getCategories } from './server/menu';
export {
  searchUsers,
  getUserFidelityBalance,
  getUserDiscountRules,
  calculateDiscountFromPoints,
  calculatePointsToEarn,
} from './server/customers';

import {
  getDineInOrders,
  updateOrderStatus,
  markOrderCompleted,
  completeAllTableOrders,
  getOrderById,
  getOrdersForTable,
  createServerOrder,
} from './server/orders';
import {
  getTables,
  getTablesWithStatus,
  getUpcomingReservations,
  closeTable,
  openTable,
  releaseTable,
} from './server/tables';
import { getMenuProducts, getCategories } from './server/menu';
import {
  searchUsers,
  getUserFidelityBalance,
  getUserDiscountRules,
  calculateDiscountFromPoints,
  calculatePointsToEarn,
} from './server/customers';

export const serverService = {
  getDineInOrders,
  getTables,
  getTablesWithStatus,
  getUpcomingReservations,
  updateOrderStatus,
  markOrderCompleted,
  completeAllTableOrders,
  getOrderById,
  getOrdersForTable,
  closeTable,
  openTable,
  releaseTable,
  createServerOrder,
  getMenuProducts,
  getCategories,
  searchUsers,
  getUserFidelityBalance,
  getUserDiscountRules,
  calculateDiscountFromPoints,
  calculatePointsToEarn,
};
