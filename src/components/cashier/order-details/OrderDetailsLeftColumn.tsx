'use client';

import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { User, ShoppingBag, MapPin } from 'lucide-react';
import { OrderDto } from '@/types/order';
import styles from '../OrderDetails.module.css';

interface OrderDetailsLeftColumnProps {
  order: OrderDto;
}

/**
 * The left column of the cashier OrderDetails: customer information (+ delivery address) and the
 * order items list. Extracted verbatim from OrderDetails (Sprint 4/6 god-file decomposition).
 */
export default function OrderDetailsLeftColumn({ order }: OrderDetailsLeftColumnProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.leftColumn}>
      {/* Customer Information */}
      <div className={styles.infoCard}>
        <h3 className={styles.infoCardHeader}>
          <User size={18} />
          {t('customer', 'Customer')}
        </h3>
        <div className={styles.infoGrid}>
          {order.customerName && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('name', 'Name')}</span>
              <span className={styles.infoValue}>{order.customerName}</span>
            </div>
          )}
          {order.customerEmail && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('email', 'Email')}</span>
              <span className={styles.infoValue}>{order.customerEmail}</span>
            </div>
          )}
          {order.customerPhone && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('phone', 'Phone')}</span>
              <span className={styles.infoValue}>{order.customerPhone}</span>
            </div>
          )}
          {order.type === 'DineIn' && order.tableNumber && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('table', 'Table')}</span>
              <span className={`${styles.infoValue} ${styles.infoValueLarge}`}>#{order.tableNumber}</span>
            </div>
          )}
        </div>

        {/* Delivery Address */}
        {order.type === 'Delivery' && order.deliveryAddress && (
          <div className={styles.deliveryAddressDivider}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>
                <MapPin size={14} className={styles.inlineLabelIcon} />
                {t('delivery_address', 'Delivery Address')}
              </span>
              <span className={styles.infoValue}>
                {order.deliveryAddress.addressLine1}
                {order.deliveryAddress.addressLine2 && `, ${order.deliveryAddress.addressLine2}`}
                <br />
                {order.deliveryAddress.postalCode} {order.deliveryAddress.city}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Order Items */}
      <div className={styles.infoCard}>
        <h3 className={styles.infoCardHeader}>
          <ShoppingBag size={18} />
          {t('items', 'Items')}
        </h3>
        <div className={styles.itemsList}>
          {order.items?.map((item, idx) => (
            <div key={idx} className={styles.orderItem}>
              <div className={styles.itemInfo}>
                <div className={styles.itemName}>
                  {item.productName}
                  {item.variationName && ` - ${item.variationName}`}
                </div>
                {item.specialInstructions && (
                  <div className={styles.itemInstructions}>💬 {item.specialInstructions}</div>
                )}
              </div>
              <div className={styles.itemPricing}>
                <div className={styles.itemQuantity}>×{item.quantity}</div>
                <div className={styles.itemPrice}>{formatPlainCurrency(item.itemTotal)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
