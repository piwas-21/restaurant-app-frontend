'use client';

// Shared checkout review composition per ADR-006: template routes re-export this layout and provide
// CSS bundles, while useCheckoutReview owns page logic so classic and craft do not duplicate markup.
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCheckoutReview } from '@/hooks/checkout/useCheckoutReview';
import FidelityPointsCheckout from '@/components/checkout/FidelityPointsCheckout';
import OrderTypeSection from '@/components/checkout/OrderTypeSection';
import CustomerInfoSection from '@/components/checkout/CustomerInfoSection';
import OrderItemsList from '@/components/checkout/OrderItemsList';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector';
import CheckoutReviewTipSelector from '@/components/checkout/CheckoutReviewTipSelector';
import OrderSummaryCard from '@/components/checkout/OrderSummaryCard';
import OrderConfirmationModal from '@/components/checkout/OrderConfirmationModal';
import CheckoutOrderAvailabilityGate from './CheckoutOrderAvailabilityGate';

// The order-type/contact edit modals are only needed after an "Edit" click, so keep them out of the
// review page's initial First Load JS (loaded on demand).
const OrderFlowModals = dynamic(() => import('@/components/order/OrderFlowModals'), { ssr: false });
const TableGuestRoundReviewContainer = dynamic(
  () => import('@/components/table-service/TableGuestRoundReviewContainer'),
  { ssr: false, loading: TableGuestRoundLoading },
);
const TableGuestVisitBlocked = dynamic(() => import('@/components/table-service/TableGuestVisitBlocked'), {
  ssr: false,
});
const TableGuestRouteRuntimeLoader = dynamic(() => import('@/contexts/TableGuestRouteRuntimeLoader'), {
  ssr: false,
});

type CssModule = Readonly<Record<string, string>>;

function TableGuestRoundLoading() {
  const { t } = useTranslation();
  return (
    <p>
      <output>{t('loading', 'Loading...')}</output>
    </p>
  );
}

/** Per-template CSS-module bundle; templates supply matching class keys for the shared markup. */
export interface CheckoutReviewStyles {
  /** Page chrome: container/content/header/grid/columns + the special-instructions section. */
  page: CssModule;
  orderType: CssModule;
  customerInfo: CssModule;
  orderItems: CssModule;
  /** The payment-method options (craft: letterpress paper-tab cards). */
  payment: CssModule;
  /** The tip selector (craft: paper-tab % toggles + craft-paper custom input). */
  tip: CssModule;
  /** The hand-written-bill / order-summary card (holds the place-order button). */
  summary: CssModule;
}

export default function CheckoutReviewLayout({ styles: bundle }: { readonly styles: CheckoutReviewStyles }) {
  return (
    <TableGuestRouteRuntimeLoader readPublicTableGuestFeature>
      <CheckoutReviewContent styles={bundle} />
    </TableGuestRouteRuntimeLoader>
  );
}

function CheckoutReviewContent({ styles: bundle }: { readonly styles: CheckoutReviewStyles }) {
  const { i18n } = useTranslation();
  const styles = bundle.page;
  const [tipValid, setTipValid] = useState(true);
  const {
    t,
    checkoutState,
    cartState,
    orderTypeFollowUp,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    onlinePaymentAvailable,
    redeemedPoints,
    handlePointsRedemption,
    taxConfig,
    taxAmount,
    pointsDiscount,
    setTipAmount,
    isSubmitting,
    submitError,
    showConfirmationModal,
    confirmedOrder,
    isLoggedIn,
    handleCloseConfirmationModal,
    handleTrackOrder,
    handlePlaceOrder,
    isTableGuestRound,
    hasPendingRound,
    isTableVisitBlocked,
    tableGuestVisitPhase,
    formatPrice,
    formatTotal,
    isLoading,
    orderAvailability,
  } = useCheckoutReview();

  if (isLoading) {
    return (
      <main className={styles.container}>
        <div className={styles.loadingState}>
          <Loader2 size={48} className={styles.spinner} />
          <p>{t('loading', 'Loading...')}</p>
        </div>
      </main>
    );
  }

  // If order is confirmed, only show the modal (the form needs customerInfo, now cleared).
  if (confirmedOrder) {
    return (
      <OrderConfirmationModal
        isOpen={showConfirmationModal}
        orderId={confirmedOrder.id}
        orderNumber={confirmedOrder.orderNumber}
        dailyOrderNumber={confirmedOrder.dailyOrderNumber}
        customerEmail={confirmedOrder.customerEmail || ''}
        paymentMethod={confirmedOrder.paymentMethod}
        guestStatusToken={confirmedOrder.guestStatusToken}
        confirmationFlow={confirmedOrder.confirmationFlow}
        isLoggedIn={isLoggedIn}
        onClose={handleCloseConfirmationModal}
        onTrackOrder={handleTrackOrder}
      />
    );
  }

  if (isTableVisitBlocked) {
    return <TableGuestVisitBlocked phase={tableGuestVisitPhase} />;
  }

  if (hasPendingRound) {
    if (tableGuestVisitPhase === 'active') {
      return <TableGuestRoundReviewContainer formatPrice={formatPrice} recoveryOnly />;
    }
    return <TableGuestVisitBlocked phase={tableGuestVisitPhase} />;
  }

  if (isTableGuestRound) {
    return <TableGuestRoundReviewContainer formatPrice={formatPrice} />;
  }

  if (orderAvailability.state !== 'available') {
    return (
      <CheckoutOrderAvailabilityGate
        availability={orderAvailability}
        orderTypeFollowUp={orderTypeFollowUp}
        styles={styles}
      />
    );
  }

  return (
    <>
      <main className={styles.container}>
        <div className={styles.content}>
          <div className={styles.header}>
            <h1 className={styles.title}>{t('review_order', 'Review Your Order')}</h1>
            <p className={styles.subtitle}>
              {t('review_order_desc', 'Please review your order details and choose a payment method')}
            </p>
          </div>

          <div className={styles.gridLayout}>
            <div className={styles.leftColumn}>
              {/* Order/contact edits stay separate and mirror changes into CheckoutContext. */}
              {/* Checkout guards validate both fields before rendering the review form. */}
              <OrderTypeSection
                orderType={checkoutState.orderType!}
                tableNumber={checkoutState.tableNumber}
                deliveryAddress={checkoutState.deliveryAddress || undefined}
                onEdit={orderTypeFollowUp.editOrderType}
                styles={bundle.orderType}
              />

              <CustomerInfoSection
                customerInfo={checkoutState.customerInfo!}
                onEdit={orderTypeFollowUp.editContact}
                styles={bundle.customerInfo}
              />

              <OrderItemsList items={cartState.items} formatPrice={formatPrice} styles={bundle.orderItems} />

              <PaymentMethodSelector
                selectedMethod={selectedPaymentMethod}
                onMethodChange={setSelectedPaymentMethod}
                orderType={checkoutState.orderType}
                onlinePaymentAvailable={onlinePaymentAvailable}
                styles={bundle.payment}
              />

              {checkoutState.specialInstructions && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>{t('special_instructions', 'Special Instructions')}</h2>
                  <div className={styles.infoCard}>
                    <p>{checkoutState.specialInstructions}</p>
                  </div>
                </section>
              )}
            </div>

            <div className={styles.rightColumn}>
              <CheckoutReviewTipSelector
                basketId={cartState.basket?.id}
                subtotal={cartState.basket?.subTotal || 0}
                selectedTipAmount={checkoutState.tipAmount || 0}
                onTipChange={setTipAmount}
                onValidityChange={setTipValid}
                locale={i18n.language || 'en'}
                disabled={isSubmitting}
                styles={bundle.tip}
              />

              <FidelityPointsCheckout
                orderSubtotal={cartState.basket?.subTotal || 0}
                onPointsRedemption={handlePointsRedemption}
              />

              <OrderSummaryCard
                basket={cartState.basket}
                taxConfig={taxConfig}
                taxAmount={taxAmount}
                pointsDiscount={pointsDiscount}
                redeemedPoints={redeemedPoints}
                tipAmount={checkoutState.tipAmount || 0}
                isSubmitting={isSubmitting}
                placeOrderDisabled={!tipValid}
                submitError={submitError}
                formatPrice={formatPrice}
                formatTotal={formatTotal}
                onPlaceOrder={handlePlaceOrder}
                styles={bundle.summary}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Edit buttons update order/contact information without leaving the review page. */}
      <OrderFlowModals followUp={orderTypeFollowUp} />
    </>
  );
}
