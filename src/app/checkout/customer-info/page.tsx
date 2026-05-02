'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useCart } from '@/components/cart/CartContext';
import { useTableContext } from '@/contexts/TableContext';
import { useCustomerInfoForm } from '@/hooks/checkout/useCustomerInfoForm';
import CustomerInfoFormFields from '@/components/checkout/CustomerInfoFormFields';
import RegistrationEncouragement from '@/components/checkout/RegistrationEncouragement';
import { AlertCircle, Utensils } from 'lucide-react';
import styles from '../../styles/CustomerInfoPage.module.css';

export default function CustomerInfoPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { state: checkoutState } = useCheckout();
  const { state: cartState } = useCart();
  const { tableContext, hasTableContext } = useTableContext();
  const form = useCustomerInfoForm();

  if (cartState.items.length === 0) {
    return (
      <main className={styles.container}>
        <div className={styles.emptyState}>
          <h1>{t('checkout_title', 'Checkout')}</h1>
          <p>{t('cart_empty_message', 'Your cart is empty')}</p>
          <button onClick={() => router.push('/menu')} className={styles.browseButton}>
            {t('cart_browse_menu_button', 'Browse Menu')}
          </button>
        </div>
      </main>
    );
  }

  if (!checkoutState.orderType && !hasTableContext) {
    return (
      <main className={styles.container}>
        <div className={styles.emptyState}>
          <AlertCircle size={64} className={styles.alertIcon} />
          <h1>{t('order_type_not_selected', 'Order Type Not Selected')}</h1>
          <p>{t('order_type_not_selected_desc', 'Please select your order type first')}</p>
          <button onClick={() => router.push('/checkout/order-type')} className={styles.browseButton}>
            {t('select_order_type', 'Select Order Type')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('customer_information', 'Customer Information')}</h1>
          <p className={styles.subtitle}>{t('customer_info_desc', 'Please provide your contact information')}</p>
        </div>

        {hasTableContext && tableContext.tableNumber && (
          <div className={styles.tableBanner}>
            <Utensils size={24} className={styles.tableBannerIcon} />
            <span className={styles.tableBannerText}>
              {t('ordering_for_table', 'Ordering for Table {{number}}', { number: tableContext.tableNumber })}
            </span>
          </div>
        )}

        {!hasTableContext && checkoutState.orderType && (
          <div className={styles.orderTypeSummary}>
            <span className={styles.label}>{t('order_type', 'Order Type')}:</span>
            <span className={styles.value}>
              {checkoutState.orderType === 'DineIn' && t('order_type_dine_in', 'Dine In')}
              {checkoutState.orderType === 'Takeaway' && t('order_type_takeaway', 'Takeaway')}
              {checkoutState.orderType === 'Delivery' && t('order_type_delivery', 'Delivery')}
            </span>
            {checkoutState.orderType === 'DineIn' && checkoutState.tableNumber && (
              <span className={styles.detail}>
                {t('table', 'Table')} {checkoutState.tableNumber}
              </span>
            )}
            {checkoutState.orderType === 'Delivery' && checkoutState.deliveryAddress && (
              <span className={styles.detail}>
                {checkoutState.deliveryAddress.street}, {checkoutState.deliveryAddress.city}
              </span>
            )}
          </div>
        )}

        <CustomerInfoFormFields form={form} />

        {!form.isLoadingUser && !form.isLoggedIn && <RegistrationEncouragement />}
      </div>
    </main>
  );
}
