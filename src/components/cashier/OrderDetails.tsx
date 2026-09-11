'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, AlertCircle } from 'lucide-react';
import { OrderDto } from '@/types/order';
import { nextOrderStatuses, type OrderStatusBadgeFill } from '@/lib/orderStatus';
import { orderStatusPresentation } from '@/lib/orderStatusPresentation';
import StatusBadge from '@/components/design-system/StatusBadge';
import styles from './OrderDetails.module.css';
import OrderDetailsActionBar from './order-details/OrderDetailsActionBar';
import OrderDetailsLeftColumn from './order-details/OrderDetailsLeftColumn';
import OrderDetailsRightColumn from './order-details/OrderDetailsRightColumn';
import OrderDetailsNotesSection from './order-details/OrderDetailsNotesSection';

// This module's binding of the SHARED status→badge-fill key (#336). The switch that used to
// live here — duplicated verbatim in OrderList, which is how a contrast fix once landed on
// one pill and not its twin — is gone; `orderStatusBadgeFill` makes the decision, and this
// Record only binds each fill key to this module's tokenised, contrast-checked class.
// Deliberately NOT getOrderStatusColor: those --status-* hues are tuned as indicators with
// nothing written on them and fail WCAG AA behind this badge's label.
const BADGE_FILL_CLASS: Record<OrderStatusBadgeFill, string> = {
  pending: styles.statusBadgePending,
  confirmed: styles.statusBadgeConfirmed,
  preparing: styles.statusBadgePreparing,
  ready: styles.statusBadgeReady,
  cancelled: styles.statusBadgeCancelled,
  completed: styles.statusBadgeCompleted,
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

  // The backend-mirrored transition table is the single source (#732): a local five-state
  // slice offered illegal skips (Pending → Preparing) and dropped OutForDelivery entirely.
  const nextStatuses = nextOrderStatuses(order.status);
  const status = orderStatusPresentation(order.status, t);

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
          <StatusBadge tone={status.tone} className={`${styles.statusBadge} ${BADGE_FILL_CLASS[status.fill]}`}>
            {status.label}
          </StatusBadge>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className={styles.contentGrid}>
        <OrderDetailsLeftColumn order={order} />
        <OrderDetailsRightColumn order={order} />
      </div>

      <OrderDetailsNotesSection order={order} notesExpanded={notesExpanded} setNotesExpanded={setNotesExpanded} />
    </div>
  );
}
