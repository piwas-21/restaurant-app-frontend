/**
 * Order enums and status unions. Extracted from types/order.ts
 * (Sprint 4/6 type-file split by domain).
 */

/**
 * Order type enum
 */
export enum OrderType {
  DineIn = 'DineIn',
  Takeaway = 'Takeaway',
  Delivery = 'Delivery',
}

/**
 * Payment method enum
 */
export enum PaymentMethod {
  Cash = 'Cash',
  CreditCard = 'CreditCard',
  DebitCard = 'DebitCard',
  OnlinePayment = 'OnlinePayment',
  MobilePayment = 'MobilePayment',
  BankTransfer = 'BankTransfer',
}

/**
 * Order status values
 */
export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'Ready'
  | 'InTransit'
  | 'In Progress'
  | 'Delivered'
  | 'Completed'
  | 'Cancelled'
  | 'PendingApproval';

/**
 * Payment status values
 */
export type PaymentStatus = 'Pending' | 'Paid' | 'PartiallyPaid' | 'Refunded' | 'Failed';
