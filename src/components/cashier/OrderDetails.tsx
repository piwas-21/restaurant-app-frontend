'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  ShoppingBag,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { OrderDto, PaymentStatus } from '@/types/order';
import styles from '../../app/styles/CashierPage.module.css';
import OrderNotes from './OrderNotes';
import { getPaymentMethodLabel } from '@/utils/paymentMethodDisplay';

interface OrderDetailsProps {
  order: OrderDto | null;
  onStatusChange: (status: string) => Promise<void>;
  onAddPayment: () => void;
  onRefund: () => void;
  onCancel: () => void;
  onToggleFocus: () => void;
  isLoading?: boolean;
}

export default function OrderDetails({
  order,
  onStatusChange,
  onAddPayment,
  onRefund,
  onCancel,
  onToggleFocus,
  isLoading = false,
}: OrderDetailsProps) {
  const { t } = useTranslation();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!order) {
    return (
      <div className={styles.noOrderSelected}>
        {t('cashier.select_order', 'Select an order to view details')}
      </div>
    );
  }

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      await onStatusChange(newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const orderStatuses = [
    'Pending',
    'Confirmed',
    'Preparing',
    'Ready',
    'Completed',
  ];

  const nextStatuses = orderStatuses.slice(
    orderStatuses.indexOf(order.status) + 1
  );

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            color: 'var(--text-color)',
            fontFamily: 'var(--font-family-serif)',
          }}
        >
          {t('cashier.order_details', 'Order Details')}
        </h2>
        <p style={{ color: 'var(--text-muted)' }}>
          {order.orderNumber} • {order.type ? t(`order_type.${order.type.toLowerCase()}`, order.type) : 'Unknown'}
        </p>
      </div>

      {/* Customer Information */}
      <section
        style={{
          background: 'var(--card-background)',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <h3
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            marginBottom: '1rem',
            color: 'var(--text-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <User size={18} /> {t('customer.info', 'Customer Information')}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {order.customerName && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {t('customer.name', 'Name')}
              </p>
              <p style={{ color: 'var(--text-color)', fontWeight: 500 }}>
                {order.customerName}
              </p>
            </div>
          )}
          {order.customerEmail && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {t('customer.email', 'Email')}
              </p>
              <p style={{ color: 'var(--text-color)', fontWeight: 500 }}>
                {order.customerEmail}
              </p>
            </div>
          )}
          {order.customerPhone && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {t('customer.phone', 'Phone')}
              </p>
              <p style={{ color: 'var(--text-color)', fontWeight: 500 }}>
                {order.customerPhone}
              </p>
            </div>
          )}
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {t('order.date', 'Order Date')}
            </p>
            <p style={{ color: 'var(--text-color)', fontWeight: 500 }}>
              {new Date(order.orderDate).toLocaleString()}
            </p>
          </div>
        </div>

        {order.type === 'DineIn' && order.tableNumber && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {t('order.table', 'Table Number')}
            </p>
            <p style={{ color: 'var(--text-color)', fontWeight: 700, fontSize: '1.25rem' }}>
              {order.tableNumber}
            </p>
          </div>
        )}

        {order.type === 'Delivery' && order.deliveryAddress && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              <MapPin size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
              {t('order.delivery_address', 'Delivery Address')}
            </p>
            <p style={{ color: 'var(--text-color)', fontWeight: 500 }}>
              {order.deliveryAddress.addressLine1}
              {order.deliveryAddress.addressLine2 && `, ${order.deliveryAddress.addressLine2}`}
              <br />
              {order.deliveryAddress.postalCode} {order.deliveryAddress.city}
              {order.deliveryAddress.country && `, ${order.deliveryAddress.country}`}
            </p>
            {order.deliveryAddress.deliveryInstructions && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
                {order.deliveryAddress.deliveryInstructions}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Order Items */}
      <section
        style={{
          background: 'var(--card-background)',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <h3
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            marginBottom: '1rem',
            color: 'var(--text-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <ShoppingBag size={18} /> {t('order.items', 'Order Items')}
        </h3>

        <div>
          {order.items?.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingBottom: '0.75rem',
                borderBottom: idx !== order.items!.length - 1 ? '1px solid var(--border-color)' : 'none',
                marginBottom: idx !== order.items!.length - 1 ? '0.75rem' : '0',
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text-color)', fontWeight: 600 }}>
                  {item.productName}
                  {item.variationName && ` - ${item.variationName}`}
                </p>
                {item.specialInstructions && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    {item.specialInstructions}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {item.quantity}x
                </p>
                <p style={{ color: 'var(--primary-color)', fontWeight: 700 }}>
                  CHF {item.itemTotal?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Order Summary */}
      <section
        style={{
          background: 'var(--card-background)',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <h3
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            marginBottom: '1rem',
            color: 'var(--text-color)',
          }}
        >
          {t('order.summary', 'Order Summary')}
        </h3>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.5rem',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>{t('order.subtotal', 'Subtotal')}</span>
          <span style={{ color: 'var(--text-color)', fontWeight: 500 }}>
            CHF {order.subTotal?.toFixed(2) || '0.00'}
          </span>
        </div>

        {order.tax > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('order.tax', 'Tax')}</span>
            <span style={{ color: 'var(--text-color)', fontWeight: 500 }}>
              CHF {order.tax?.toFixed(2) || '0.00'}
            </span>
          </div>
        )}

        {order.deliveryFee > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              {t('order.delivery_fee', 'Delivery Fee')}
            </span>
            <span style={{ color: 'var(--text-color)', fontWeight: 500 }}>
              CHF {order.deliveryFee?.toFixed(2) || '0.00'}
            </span>
          </div>
        )}

        {order.discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--primary-color)' }}>{t('order.discount', 'Discount')}</span>
            <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
              -CHF {order.discount?.toFixed(2) || '0.00'}
            </span>
          </div>
        )}

        {order.userLimitAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--primary-color)' }}>
              {t('order.customer_discount', 'Customer Discount')}
            </span>
            <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
              -CHF {order.userLimitAmount?.toFixed(2) || '0.00'}
            </span>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: '1rem',
            borderTop: '2px solid var(--border-color)',
            marginTop: '1rem',
          }}
        >
          <span style={{ color: 'var(--text-color)', fontWeight: 700, fontSize: '1.125rem' }}>
            {t('order.total', 'Total')}
          </span>
          <span style={{ color: 'var(--primary-color)', fontWeight: 700, fontSize: '1.25rem' }}>
            CHF {order.total?.toFixed(2) || '0.00'}
          </span>
        </div>
      </section>

      {/* Payment Status */}
      <section
        style={{
          background: 'var(--card-background)',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-color)',
        }}
      >
        <h3
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            marginBottom: '1rem',
            color: 'var(--text-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CreditCard size={18} /> {t('payment.status', 'Payment Status')}
        </h3>

        <div style={{ marginBottom: '1rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>{t('payment.status', 'Status')}</span>
            <span
              style={{
                padding: '0.25rem 0.75rem',
                background: 'var(--primary-color)',
                color: 'white',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {t(`payment_status.${order.paymentStatus?.toLowerCase() || 'pending'}`, order.paymentStatus)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('payment.total_paid', 'Total Paid')}</span>
            <span style={{ color: 'var(--text-color)', fontWeight: 500 }}>
              CHF {order.totalPaid?.toFixed(2) || '0.00'}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-color)',
              marginTop: '0.75rem',
            }}
          >
            <span style={{ color: 'var(--text-color)', fontWeight: 700 }}>
              {t('payment.remaining', 'Remaining')}
            </span>
            <span
              style={{
                color: order.remainingAmount! > 0 ? '#ef4444' : '#10b981',
                fontWeight: 700,
              }}
            >
              CHF {Math.abs(order.remainingAmount || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payments list */}
        {order.payments && order.payments.length > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              {t('payment.payments_list', 'Payments')}
            </p>
            {order.payments.map((payment, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.5rem',
                  background: 'var(--background-light)',
                  borderRadius: '4px',
                  marginBottom: '0.5rem',
                }}
              >
                <div>
                  <p style={{ color: 'var(--text-color)', fontSize: '0.875rem' }}>
                    {getPaymentMethodLabel(payment.paymentMethod)}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {payment.paymentDate ? new Date(payment.paymentDate).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <p style={{ color: 'var(--text-color)', fontWeight: 600 }}>
                  CHF {payment.amount?.toFixed(2) || '0.00'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Action Buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {nextStatuses.length > 0 && (
          <select
            value=""
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={isUpdating}
            style={{
              padding: '0.75rem',
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="">{t('cashier.update_status', 'Update Status')}</option>
            {nextStatuses.map((status) => (
              <option key={status} value={status}>
                {t(`order_status.${status.toLowerCase()}`, status)}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={onAddPayment}
          style={{
            padding: '0.75rem',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('cashier.add_payment', 'Add Payment')}
        </button>

        {order.totalPaid > 0 && (
          <button
            onClick={onRefund}
            style={{
              padding: '0.75rem',
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('cashier.refund', 'Refund')}
          </button>
        )}

        {order.status !== 'Completed' && order.status !== 'Cancelled' && (
          <button
            onClick={onCancel}
            style={{
              padding: '0.75rem',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('cashier.cancel_order', 'Cancel Order')}
          </button>
        )}

        <button
          onClick={onToggleFocus}
          style={{
            padding: '0.75rem',
            background: order.isFocusOrder ? '#6b7280' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {order.isFocusOrder ? t('cashier.unmark_focus', 'Unmark Focus') : t('cashier.mark_focus', 'Mark Focus')}
        </button>
      </div>

      {/* Order Notes Component */}
      <OrderNotes order={order} />
    </div>
  );
}
