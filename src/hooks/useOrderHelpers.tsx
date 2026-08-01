import { formatCurrency } from '@/utils/currency';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { OrderStatus } from '@/types/order';
import { orderStatusLabel, paymentStatusLabel } from '@/lib/orderStatus';
import { UtensilsCrossed, Store, Truck, Package } from 'lucide-react';

/**
 * Custom hook providing utility functions for order management
 */
export const useOrderHelpers = () => {
  const { t } = useTranslation();

  const formatPrice = (price: number) => formatCurrency(price);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getOrderTypeIcon = (orderType: string): React.ReactNode => {
    switch (orderType) {
      case 'DineIn':
        return <UtensilsCrossed size={16} />;
      case 'Takeaway':
        return <Store size={16} />;
      case 'Delivery':
        return <Truck size={16} />;
      default:
        return <Package size={16} />;
    }
  };

  const getOrderTypeLabel = (orderType: string) => {
    switch (orderType) {
      case 'DineIn':
        return t('order_type_dine_in', 'Dine In');
      case 'Takeaway':
        return t('order_type_takeaway', 'Takeaway');
      case 'Delivery':
        return t('order_type_delivery', 'Delivery');
      default:
        return orderType;
    }
  };

  // Delegates to the single map. The ladder this replaces handled EIGHT of the union's twelve
  // members, so `PendingApproval`, `In Progress`, `OutForDelivery` and `Refunded` all fell through
  // its `default` and rendered as raw untranslated English in every locale.
  const getStatusLabel = (status: string) => orderStatusLabel(status, t);

  // `Overpaid` is handled OUTSIDE the map on purpose: it is a real backend PaymentStatus that the
  // frontend union still omits (see the note on `PaymentStatus` in types/order/enums.ts), so it
  // cannot be an entry in a `Record<PaymentStatus, …>` until that contract is reconciled. Keeping
  // the case here preserves today's behaviour rather than silently dropping a status that reaches
  // the UI through the admin filter.
  const getPaymentStatusLabel = (paymentStatus: string) =>
    paymentStatus === 'Overpaid' ? t('payment_status_overpaid', 'Overpaid') : paymentStatusLabel(paymentStatus, t);

  // The statuses a human may pick in the status dropdowns. Deliberately NOT every union member:
  // `PendingApproval` and `Refunded` are reached by their own flows, and `In Progress` is legacy.
  const statusOptions: OrderStatus[] = [
    'Pending',
    'Confirmed',
    'Preparing',
    'Ready',
    'OutForDelivery',
    'Delivered',
    'Completed',
    'Cancelled',
  ];

  return {
    formatPrice,
    formatDate,
    getOrderTypeIcon,
    getOrderTypeLabel,
    getStatusLabel,
    getPaymentStatusLabel,
    statusOptions,
  };
};
