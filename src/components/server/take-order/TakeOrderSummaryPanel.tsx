import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { UserDto } from '@/services/serverService';
import CustomerSearchInput from '../CustomerSearchInput';
import CustomerInfoPanel from '../CustomerInfoPanel';
import { OrderItem } from './orderItems';
import styles from './TakeOrderSummaryPanel.module.css';

interface TakeOrderSummaryPanelProps {
  error: string | null;
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  selectedUser: UserDto | null;
  onUserSelect: (user: UserDto | null) => void;
  orderSubtotal: number;
  pointsToRedeem: number;
  onPointsChange: (points: number) => void;
  orderItems: OrderItem[];
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  orderNotes: string;
  onOrderNotesChange: (value: string) => void;
  orderTotal: number;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export default function TakeOrderSummaryPanel({
  error,
  customerName,
  onCustomerNameChange,
  selectedUser,
  onUserSelect,
  orderSubtotal,
  pointsToRedeem,
  onPointsChange,
  orderItems,
  onUpdateQuantity,
  onRemoveItem,
  orderNotes,
  onOrderNotesChange,
  orderTotal,
  isSubmitting,
  onSubmit,
}: Readonly<TakeOrderSummaryPanelProps>) {
  const { t } = useTranslation();

  return (
    <div className={styles.orderPanel}>
      <h3 className={styles.orderTitle}>{t('server.order_summary', 'Order Summary')}</h3>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.customerInfo}>
        <CustomerSearchInput
          value={customerName}
          selectedUser={selectedUser}
          onValueChange={onCustomerNameChange}
          onUserSelect={onUserSelect}
        />
      </div>

      {selectedUser && (
        <CustomerInfoPanel
          user={selectedUser}
          orderTotal={orderSubtotal}
          pointsToRedeem={pointsToRedeem}
          onPointsChange={onPointsChange}
        />
      )}

      <div className={styles.orderItems}>
        {orderItems.length === 0 ? (
          <div className={styles.emptyOrder}>{t('server.no_items', 'No items added yet')}</div>
        ) : (
          orderItems.map((item, index) => (
            <div key={index} className={styles.orderItem}>
              <div className={styles.orderItemInfo}>
                <span className={styles.orderItemName}>
                  {item.product.name}
                  {item.variationName && <span className={styles.variationLabel}> ({item.variationName})</span>}
                </span>
                {item.notes && <span className={styles.orderItemNotes}>{item.notes}</span>}
                <span className={styles.orderItemPrice}>{formatPlainCurrency(item.unitPrice * item.quantity)}</span>
              </div>
              <div className={styles.orderItemActions}>
                <button className={styles.qtyButton} onClick={() => onUpdateQuantity(index, item.quantity - 1)}>
                  −
                </button>
                <span className={styles.qtyValue}>{item.quantity}</span>
                <button className={styles.qtyButton} onClick={() => onUpdateQuantity(index, item.quantity + 1)}>
                  +
                </button>
                <button className={styles.removeButton} onClick={() => onRemoveItem(index)}>
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={styles.orderNotes}>
        <textarea
          placeholder={t('server.order_notes', 'Order notes (optional)')}
          value={orderNotes}
          onChange={(e) => onOrderNotesChange(e.target.value)}
          className={styles.notesInput}
          rows={2}
        />
      </div>

      <div className={styles.orderFooter}>
        <div className={styles.orderTotal}>
          <span>{t('server.total', 'Total')}</span>
          <span className={styles.totalAmount}>{formatPlainCurrency(orderTotal)}</span>
        </div>

        <button className={styles.submitButton} onClick={onSubmit} disabled={isSubmitting || orderItems.length === 0}>
          {isSubmitting ? t('server.creating_order', 'Creating Order...') : t('server.place_order', 'Place Order')}
        </button>
      </div>
    </div>
  );
}
