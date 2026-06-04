'use client';

import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import {
  User,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Package,
  Clock,
  FileText,
  UtensilsCrossed,
  Store,
  Truck,
} from 'lucide-react';
import { OrderDto } from '@/types/order';
import { formatOrderPrice, formatOrderDate } from '@/utils/orderDetailsFormatters';
import styles from '../OrderDetailsModal.module.css';

interface OrderDetailsInfoProps {
  order: OrderDto;
}

/**
 * Order information, customer, delivery address and order-items sections of the
 * OrderDetailsModal. Extracted verbatim from OrderDetailsModal (Sprint 6 god-file decomposition).
 */
export default function OrderDetailsInfo({ order }: OrderDetailsInfoProps) {
  const { t } = useTranslation();

  const getOrderTypeIcon = () => {
    switch (order.type) {
      case 'DineIn':
        return <UtensilsCrossed size={20} />;
      case 'Takeaway':
        return <Store size={20} />;
      case 'Delivery':
        return <Truck size={20} />;
      default:
        return <Package size={20} />;
    }
  };

  const getOrderTypeLabel = () => {
    switch (order.type) {
      case 'DineIn':
        return t('order_type_dine_in', 'Dine In');
      case 'Takeaway':
        return t('order_type_takeaway', 'Takeaway');
      case 'Delivery':
        return t('order_type_delivery', 'Delivery');
      default:
        return order.type;
    }
  };

  return (
    <>
      {/* Order Info Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Package size={18} />
          {t('order_information', 'Order Information')}
        </h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('order_type', 'Order Type')}</span>
            <div className={styles.infoValue}>
              {getOrderTypeIcon()}
              {getOrderTypeLabel()}
            </div>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('order_date', 'Order Date')}</span>
            <div className={styles.infoValue}>
              <Clock size={16} />
              {t('order_created', 'Order created')}: {formatOrderDate(order.orderDate)}
            </div>
          </div>
          {order.type === 'DineIn' && order.tableNumber && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{t('table_number', 'Table Number')}</span>
              <div className={styles.infoValue}>
                <UtensilsCrossed size={16} />
                {t('table', 'Table')} {order.tableNumber}
              </div>
            </div>
          )}
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>{t('payment_status', 'Payment Status')}</span>
            <div className={styles.infoValue}>
              <CreditCard size={16} />
              {order.isFullyPaid ? t('paid', 'Paid') : t('pending', 'Pending')}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Info Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <User size={18} />
          {t('customer_information', 'Customer Information')}
        </h3>
        <div className={styles.customerInfo}>
          {order.customerName && (
            <div className={styles.customerDetail}>
              <User size={16} />
              <span>{order.customerName}</span>
            </div>
          )}
          {order.customerEmail && (
            <div className={styles.customerDetail}>
              <Mail size={16} />
              <a href={`mailto:${order.customerEmail}`}>{order.customerEmail}</a>
            </div>
          )}
          {order.customerPhone && (
            <div className={styles.customerDetail}>
              <Phone size={16} />
              <a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Address Section */}
      {order.type === 'Delivery' && order.deliveryAddress && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <MapPin size={18} />
            {t('delivery_address', 'Delivery Address')}
          </h3>
          <div className={styles.addressCard}>
            <p className={styles.addressLine}>{order.deliveryAddress.addressLine1}</p>
            {order.deliveryAddress.addressLine2 && (
              <p className={styles.addressLine}>{order.deliveryAddress.addressLine2}</p>
            )}
            <p className={styles.addressLine}>
              {order.deliveryAddress.postalCode} {order.deliveryAddress.city}
            </p>
            {order.deliveryAddress.deliveryInstructions && (
              <p className={styles.deliveryInstructions}>
                <FileText size={14} />
                {order.deliveryAddress.deliveryInstructions}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Order Items Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Package size={18} />
          {t('order_items', 'Order Items')} ({order.items.length})
        </h3>
        <div className={styles.itemsList}>
          {order.items.map((item) => (
            <div key={item.id} className={styles.orderItem}>
              {item.productImageUrl && (
                <div className={styles.itemImage}>
                  <Image
                    src={item.productImageUrl}
                    alt={item.productName || ''}
                    width={60}
                    height={60}
                    style={{ objectFit: 'cover' }}
                  />
                </div>
              )}
              <div className={styles.itemDetails}>
                <h4 className={styles.itemName}>{item.productName}</h4>
                {item.variationName && <p className={styles.itemVariation}>{item.variationName}</p>}
                {item.specialInstructions && (
                  <p className={styles.itemInstructions}>
                    <FileText size={12} />
                    {item.specialInstructions}
                  </p>
                )}
                <div className={styles.itemQuantity}>
                  {t('qty', 'Qty')}: {item.quantity} × {formatOrderPrice(item.unitPrice)}
                </div>
              </div>
              <div className={styles.itemTotal}>{formatOrderPrice(item.itemTotal)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
