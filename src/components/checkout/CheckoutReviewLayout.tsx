'use client';

// Shared checkout review/confirm composition (ADR-006 — Prompt 6 seam). The
// review page is a full-page template override (like auth): the route file
// re-exports `@active-template/CheckoutReviewPage`, and each template renders
// THIS layout with its own CSS-module bundle. Keeping the composition here (not
// duplicated per template) is the cart/auth dedup recipe — classic and craft
// differ only in the `styles` bundle, so classic stays byte-identical and Sonar
// sees no cross-template duplication. All page logic stays in `useCheckoutReview`.
import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useCheckoutReview } from '@/hooks/checkout/useCheckoutReview';
import FidelityPointsCheckout from '@/components/checkout/FidelityPointsCheckout';
import OrderTypeSection from '@/components/checkout/OrderTypeSection';
import CustomerInfoSection from '@/components/checkout/CustomerInfoSection';
import OrderItemsList from '@/components/checkout/OrderItemsList';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector';
import TipSelector from '@/components/checkout/TipSelector';
import OrderSummaryCard from '@/components/checkout/OrderSummaryCard';
import OrderConfirmationModal from '@/components/checkout/OrderConfirmationModal';

// The order-type/contact edit modals are only needed after an "Edit" click, so keep them out of the
// review page's initial First Load JS (loaded on demand).
const OrderFlowModals = dynamic(() => import('@/components/order/OrderFlowModals'), { ssr: false });

type CssModule = Readonly<Record<string, string>>;

/** Per-template CSS-module bundle for the review composition. Each template
 *  supplies modules with the SAME class-name keys, so the shared DOM below is
 *  styled by whichever template is active. */
export interface CheckoutReviewStyles {
  /** Page chrome: container/content/header/grid/columns + the special-instructions section. */
  page: CssModule;
  orderType: CssModule;
  customerInfo: CssModule;
  orderItems: CssModule;
  /** The hand-written-bill / order-summary card (holds the place-order button). */
  summary: CssModule;
}

export default function CheckoutReviewLayout({ styles: bundle }: { readonly styles: CheckoutReviewStyles }) {
  const styles = bundle.page;
  const {
    t,
    checkoutState,
    cartState,
    orderTypeFollowUp,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
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
    handlePlaceOrder,
    formatPrice,
    formatTotal,
    isLoading,
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
        orderNumber={confirmedOrder.orderNumber}
        customerEmail={confirmedOrder.customerEmail || ''}
        isLoggedIn={isLoggedIn}
        onClose={handleCloseConfirmationModal}
      />
    );
  }

  return (
    <>
      <main className={styles.container}>
        <div className={styles.content}>
          {/* Header */}
          <div className={styles.header}>
            <h1 className={styles.title}>{t('review_order', 'Review Your Order')}</h1>
            <p className={styles.subtitle}>
              {t('review_order_desc', 'Please review your order details and choose a payment method')}
            </p>
          </div>

          <div className={styles.gridLayout}>
            {/* Left Column - Order Details */}
            <div className={styles.leftColumn}>
              {/* "Edit Order Details" changes the order type (+ its table/address detail); "Edit
                  Customer Information" edits name/email/phone only — two distinct editors so the
                  Order Details edit no longer opens the contact modal. Both edit in place (the
                  follow-up modals mirror into CheckoutContext, so these sections update live). */}
              <OrderTypeSection
                orderType={checkoutState.orderType || 'Takeaway'}
                tableNumber={checkoutState.tableNumber}
                deliveryAddress={checkoutState.deliveryAddress || undefined}
                onEdit={orderTypeFollowUp.editOrderType}
                styles={bundle.orderType}
              />

              {/* Non-null: the prereq guard redirects away when customerInfo is absent. */}
              <CustomerInfoSection
                customerInfo={checkoutState.customerInfo!}
                onEdit={orderTypeFollowUp.editContact}
                styles={bundle.customerInfo}
              />

              <OrderItemsList items={cartState.items} formatPrice={formatPrice} styles={bundle.orderItems} />

              <PaymentMethodSelector selectedMethod={selectedPaymentMethod} onMethodChange={setSelectedPaymentMethod} />

              {/* Special Instructions */}
              {checkoutState.specialInstructions && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>{t('special_instructions', 'Special Instructions')}</h2>
                  <div className={styles.infoCard}>
                    <p>{checkoutState.specialInstructions}</p>
                  </div>
                </section>
              )}
            </div>

            {/* Right Column - Order Summary */}
            <div className={styles.rightColumn}>
              <TipSelector
                subtotal={cartState.basket?.subTotal || 0}
                selectedTipAmount={checkoutState.tipAmount || 0}
                onTipChange={setTipAmount}
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

      {/* Edit-in-place: the "Edit" buttons open these to change order type / table / address /
          contact info without leaving the review page. */}
      <OrderFlowModals followUp={orderTypeFollowUp} />
    </>
  );
}
