'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, AlertCircle } from 'lucide-react';
import { OrderDto } from '@/types/order';
import styles from './OrderDetails.module.css';
import OrderDetailsActionBar from './order-details/OrderDetailsActionBar';
import OrderDetailsLeftColumn from './order-details/OrderDetailsLeftColumn';
import OrderDetailsRightColumn from './order-details/OrderDetailsRightColumn';
import OrderDetailsNotesSection from './order-details/OrderDetailsNotesSection';

// Helper to get the status badge's fill modifier class. Returns a class rather than a
// colour so the fill stays in the stylesheet, tokenised and contrast-checked (see
// .statusBadge in OrderDetails.module.css) instead of inline on the span. Deliberately
// NOT getOrderStatusColor: that returns the shared --status-* hues, which are tuned as
// indicators with nothing written on them and fail WCAG AA behind this badge's label.
const getStatusBadgeModifier = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending':
      return styles.statusBadgePending;
    case 'confirmed':
      return styles.statusBadgeConfirmed;
    case 'preparing':
      return styles.statusBadgePreparing;
    case 'ready':
      return styles.statusBadgeReady;
    case 'cancelled':
      return styles.statusBadgeCancelled;
    // An unrecognised status falls back to the Completed fill — the same grey the
    // old hex map used as its default. The class name overstates it: the order is
    // not necessarily completed, the grey is just the neutral fill.
    case 'completed':
    default:
      return styles.statusBadgeCompleted;
  }
};

interface OrderDetailsProps {
  order: OrderDto | null;
  onStatusChange: (status: string) => Promise<void>;
  onAddPayment: () => void;
  onRefund: () => void;
  onCancel: () => void;
  onToggleFocus: () => void;
  onQuickConfirm?: (orderId: string) => void;
  isLoading?: boolean;
}

export default function OrderDetails({
  order,
  onStatusChange,
  onAddPayment,
  onRefund,
  onCancel,
  onToggleFocus,
  onQuickConfirm,
  isLoading: _isLoading = false,
}: OrderDetailsProps) {
  const { t } = useTranslation();
  const [isUpdating, setIsUpdating] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [noteText, setNoteText] = useState('');

  if (!order) {
    return (
      <div className={styles.noOrderSelected}>
        <AlertCircle size={48} />
        <p>{t('cashier.select_order', 'Select an order to view details')}</p>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    setIsStatusMenuOpen(false);
    try {
      await onStatusChange(newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const orderStatuses = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed'];
  const nextStatuses = orderStatuses.slice(orderStatuses.indexOf(order.status) + 1);

  const orderTypeEmoji = order.type === 'DineIn' ? '🍽️' : order.type === 'Takeaway' ? '🛍️' : '🚚';

  return (
    <div className={styles.orderDetailsWrapper}>
      <OrderDetailsActionBar
        order={order}
        onQuickConfirm={onQuickConfirm}
        onAddPayment={onAddPayment}
        onRefund={onRefund}
        onCancel={onCancel}
        onToggleFocus={onToggleFocus}
        nextStatuses={nextStatuses}
        isUpdating={isUpdating}
        isStatusMenuOpen={isStatusMenuOpen}
        setIsStatusMenuOpen={setIsStatusMenuOpen}
        onStatusSelect={handleStatusChange}
      />

      {/* Header */}
      <div className={styles.orderDetailsHeader}>
        <div className={styles.orderHeaderTop}>
          <div>
            <h2 className={styles.orderTitle}>
              {orderTypeEmoji} {order.orderNumber}
            </h2>
            <p className={styles.orderSubtitle}>
              <Clock size={14} />
              {new Date(order.orderDate).toLocaleString()}
            </p>
          </div>
          <span className={`${styles.statusBadge} ${getStatusBadgeModifier(order.status)}`}>
            {t(`order_status_${order.status.toLowerCase()}`, order.status)}
          </span>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className={styles.contentGrid}>
        <OrderDetailsLeftColumn order={order} />
        <OrderDetailsRightColumn order={order} />
      </div>

      <OrderDetailsNotesSection
        order={order}
        notesExpanded={notesExpanded}
        setNotesExpanded={setNotesExpanded}
        noteText={noteText}
        setNoteText={setNoteText}
      />
    </div>
  );
}
