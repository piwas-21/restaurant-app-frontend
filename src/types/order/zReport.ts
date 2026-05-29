/**
 * Z-Report (end-of-day financial summary) types.
 * Extracted from types/order.ts (Sprint 4/6 type-file split by domain).
 */

import { ApiResponse } from './common';

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
  transactionCount: number;
  totalAmount: number;
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
  discounts: ZReportDiscounts;
  refunds: ZReportRefunds;
  cancelledOrdersCount: number;
  cancelledOrdersTotal: number;
  paymentsByMethod: ZReportPaymentMethod[];
  salesByOrderType: ZReportOrderType[];
  salesByProductType: ZReportProductType[];
  topSellingItems: ZReportTopItem[];
}

export type ZReportApiResponse = ApiResponse<ZReportDto>;
