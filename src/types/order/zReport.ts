/**
 * Z-Report (end-of-day financial summary) types.
 * Extracted from types/order.ts (Sprint 4/6 type-file split by domain).
 */

import { ApiResponse } from './common';
import { ZReportAccountCashMovements } from './zReportAccountCash';

export interface ZReportDiscounts {
  totalDiscounts: number;
  promoCodeDiscounts: number;
  customerDiscounts: number;
  fidelityPointsDiscounts: number;
}

export interface ZReportRefunds {
  refundCount: number;
  totalRefundedAmount: number;
}

export interface ZReportPaymentMethod {
  paymentMethod: string;
  currency?: string | null;
  transactionCount: number;
  orderAmount?: number;
  tipAmount?: number;
  totalAmount: number;
}

export interface ZReportCurrencyAmount {
  currency: string | null;
  amountMinor: number;
}

export interface ZReportOrderType {
  orderType: string;
  orderCount: number;
  totalAmount: number;
}

export interface ZReportProductType {
  productType: string;
  itemCount: number;
  totalAmount: number;
}

export interface ZReportTopItem {
  productName: string;
  quantitySold: number;
  totalRevenue: number;
}

export interface ZReportDto {
  reportDate: string;
  generatedAt: string;
  totalTransactions: number;
  grossSales: number;
  netSales: number;
  totalTax: number;
  totalTips: number;
  totalDeliveryFees: number;
  /** Additional staff gratuities, separate from legacy guest/order tips. */
  staffTipsCollected?: ZReportCurrencyAmount[] | null;
  staffTipsRefunded?: ZReportCurrencyAmount[] | null;
  /** Net recorded cash tender movement; no opening float or physical cash count is included. */
  netCashCollected?: ZReportCurrencyAmount[] | null;
  discounts: ZReportDiscounts;
  refunds: ZReportRefunds;
  cancelledOrdersCount: number;
  cancelledOrdersTotal: number;
  paymentsByMethod: ZReportPaymentMethod[];
  salesByOrderType: ZReportOrderType[];
  salesByProductType: ZReportProductType[];
  topSellingItems: ZReportTopItem[];
  accountCashMovements?: ZReportAccountCashMovements | null;
}

export type ZReportApiResponse = ApiResponse<ZReportDto>;
