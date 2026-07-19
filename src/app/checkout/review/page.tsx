'use client';

import { formatPlainCurrency, formatCurrency } from '@/utils/currency';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useOrderTypeFollowUp } from '@/hooks/order/useOrderTypeFollowUp';
import OrderFlowModals from '@/components/order/OrderFlowModals';
import { useCart } from '@/components/cart/CartContext';
import { useSession } from '@/hooks/useSession';
import { createOrderFromBasket } from '@/services/orderService';
import { sendOrderConfirmationEmails } from '@/services/emailService';
import FidelityPointsCheckout from '@/components/checkout/FidelityPointsCheckout';
import OrderTypeSection from '@/components/checkout/OrderTypeSection';
import CustomerInfoSection from '@/components/checkout/CustomerInfoSection';
import OrderItemsList from '@/components/checkout/OrderItemsList';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector';
import TipSelector from '@/components/checkout/TipSelector';
import OrderSummaryCard from '@/components/checkout/OrderSummaryCard';
import OrderConfirmationModal from '@/components/checkout/OrderConfirmationModal';
import { adminTaxConfigurationService } from '@/services/adminTaxConfigurationService';
import { getTranslatedOrderError } from '@/utils/orderErrorHandler';
import type { TaxConfiguration } from '@/services/adminTaxConfigurationService';
import {
  PaymentMethod,
  CreateOrderFromBasketCommand,
  CreateOrderDeliveryAddressDto,
  OrderType as OrderTypeEnum,
} from '@/types/order';
import { useSnackbar } from 'notistack';
import { Loader2 } from 'lucide-react';
import { isLoggedInForAnalytics, trackEvent } from '@/lib/analytics';
import styles from '../../styles/ReviewPage.module.css';

export default function ReviewPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { state: checkoutState, clearCheckout, setTipAmount } = useCheckout();
  const { clearOrderType } = useOrderType();
  const { state: cartState, clearCart } = useCart();
  // Order-type follow-up modals, hosted here so the "Edit" buttons re-open the order-type/contact
  // editor IN PLACE instead of bouncing to the retired /checkout/* pages (which redirect to /menu).
  const orderTypeFollowUp = useOrderTypeFollowUp();
  // Ensure a session exists on mount (auto-create side effect) — the from-basket order call
  // resolves the basket from the X-Session-Id header apiClient attaches, so no id is read here.
  useSession();

  // Payment method state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);

  // Fidelity points redemption state
  const [redeemedPoints, setRedeemedPoints] = useState(0);

  // Tax configuration state
  const [taxConfig, setTaxConfig] = useState<TaxConfiguration | null>(null);
  const [taxAmount, setTaxAmount] = useState(0);
  const [pointsDiscount, setPointsDiscount] = useState(0);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Order confirmation modal state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    id: string;
    orderNumber: string;
    customerEmail: string;
  } | null>(null);

  // Check if user is logged in based on auth token
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    // Check if user has an authentication token (logged in)
    // Note: sessionId exists for both guests and logged-in users
    if (typeof window !== 'undefined') {
      const authToken = localStorage.getItem('auth_token');
      setIsLoggedIn(!!authToken);
    }
  }, []);

  // Page-view event — fire ONCE on first client mount. Ref guard prevents
  // re-fire under React 19 StrictMode double-invoke in dev and re-renders
  // from cart/tax effects below. Fires even if the prereq-check effect
  // redirects the user away — that bounce is itself a useful signal.
  const reviewViewedFiredRef = useRef(false);
  useEffect(() => {
    if (reviewViewedFiredRef.current) return;
    reviewViewedFiredRef.current = true;
    trackEvent('checkout_review_viewed', { loggedIn: isLoggedInForAnalytics() });
  }, []);

  // Auto-show modal when order is confirmed
  useEffect(() => {
    if (confirmedOrder) {
      setShowConfirmationModal(true);
    }
  }, [confirmedOrder]);

  // Handler for points redemption
  const handlePointsRedemption = (points: number, discountAmount: number) => {
    setRedeemedPoints(points);
    setPointsDiscount(discountAmount);
  };

  // Handler for closing confirmation modal (X / ESC / backdrop / "Back to Menu").
  // The full confirmation page fetches the order from an auth-gated endpoint, so a GUEST would land
  // on "Failed to load order details". Only logged-in users can view it; guests go back to /menu
  // (the modal already showed them the order number + emailed confirmation).
  const handleCloseConfirmationModal = () => {
    setShowConfirmationModal(false);
    if (!confirmedOrder) return;
    if (isLoggedIn) {
      router.push(`/checkout/confirmation?orderId=${confirmedOrder.id}&orderNumber=${confirmedOrder.orderNumber}`);
    } else {
      router.push('/menu');
    }
  };

  // "Edit" on the review page: re-open the order-type/contact modal for the chosen type IN PLACE
  // (the modals mirror into CheckoutContext, so the review sections update live). `true` forces the
  // modal open even for a takeaway user whose profile is already complete.
  const handleEditOrder = () => {
    if (checkoutState.orderType) {
      orderTypeFollowUp.pickType(checkoutState.orderType, 'checkout_review', true);
    }
  };

  // Fetch tax configuration based on order type
  useEffect(() => {
    const fetchTaxConfig = async () => {
      if (!checkoutState.orderType) return;

      try {
        const config = await adminTaxConfigurationService.getTaxForOrderType(checkoutState.orderType);
        setTaxConfig(config);

        // Calculate tax for display based on the fetched config
        // Note: Baskets have tax = 0, tax is only calculated on order creation in backend
        // For checkout/review, we calculate tax for display purposes
        if (config && cartState.basket) {
          const subtotal =
            cartState.basket.subTotal - (cartState.basket.discount || 0) - (cartState.basket.customerDiscount || 0);
          const calculatedTax = subtotal * (config.rate / 100);
          setTaxAmount(calculatedTax);
        } else {
          setTaxAmount(0);
        }
      } catch (error) {
        console.warn('Failed to fetch tax configuration:', error);
        // Fall back to basket tax value if available
        setTaxConfig(null);
        setTaxAmount(cartState.basket?.tax || 0);
      }
    };
    // fetchTaxConfig has its own try/catch (logs and falls back); fire-and-forget.
    void fetchTaxConfig();
  }, [checkoutState.orderType, cartState.basket]);

  // Check prerequisites (but don't redirect if order was just confirmed)
  useEffect(() => {
    // Don't redirect if we have a confirmed order being shown
    if (confirmedOrder) return;

    if (cartState.items.length === 0) {
      router.push('/cart');
    } else if (!checkoutState.orderType || !checkoutState.customerInfo) {
      // Order type and contact info are now collected on /menu via the
      // sidebar toggle + type modal (§C1.5.e/g/h). Anything missing here
      // means the user landed on /review by deep link or back-button —
      // bounce them to /menu so the modal fills the gap.
      router.push('/menu');
    }
  }, [cartState.items.length, checkoutState.orderType, checkoutState.customerInfo, router, confirmedOrder]);

  // Show loading state only if we don't have a confirmed order (modal will display instead)
  if ((cartState.items.length === 0 || !checkoutState.orderType || !checkoutState.customerInfo) && !confirmedOrder) {
    return (
      <main className={styles.container}>
        <div className={styles.loadingState}>
          <Loader2 size={48} className={styles.spinner} />
          <p>{t('loading', 'Loading...')}</p>
        </div>
      </main>
    );
  }

  // If order is confirmed, only show the modal (don't render the form which needs customerInfo)
  if (confirmedOrder) {
    return (
      <>
        <OrderConfirmationModal
          isOpen={showConfirmationModal}
          orderNumber={confirmedOrder.orderNumber}
          customerEmail={confirmedOrder.customerEmail || ''}
          isLoggedIn={isLoggedIn}
          onClose={handleCloseConfirmationModal}
        />
      </>
    );
  }

  const formatPrice = (price: number) => formatCurrency(price);

  // Check if customer has active discount (for display formatting only)
  const customerHasDiscount = (cartState.basket?.customerDiscount || 0) > 0 || (cartState.basket?.discount || 0) > 0;

  // Format total with appropriate decimals (backend already handles rounding)
  const formatTotal = (total: number) => {
    const decimals = customerHasDiscount ? 0 : 2;
    return formatPlainCurrency(total, decimals);
  };

  const handlePlaceOrder = async () => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Prepare delivery address if delivery order
      let deliveryAddress: CreateOrderDeliveryAddressDto | undefined;
      if (checkoutState.orderType === 'Delivery' && checkoutState.deliveryAddress) {
        deliveryAddress = {
          addressLine1: checkoutState.deliveryAddress.street,
          city: checkoutState.deliveryAddress.city,
          postalCode: checkoutState.deliveryAddress.postalCode,
          country: checkoutState.deliveryAddress.country,
          deliveryInstructions: checkoutState.deliveryAddress.additionalInfo,
        };
      }

      // Build the from-basket order command. The server reads the persisted basket (via the
      // X-Session-Id header apiClient attaches) and derives the order items itself — the client no
      // longer builds the item payload (menu-bundles redesign #157, slice 5).
      const orderCommand: CreateOrderFromBasketCommand = {
        customerName: checkoutState.customerInfo?.name,
        customerEmail: checkoutState.customerInfo?.email,
        customerPhone: checkoutState.customerInfo?.phone,
        type: checkoutState.orderType as OrderTypeEnum,
        tableNumber:
          checkoutState.orderType === 'DineIn' && checkoutState.tableNumber
            ? parseInt(checkoutState.tableNumber, 10)
            : undefined,
        notes: checkoutState.specialInstructions || undefined,
        deliveryAddress,
        payments: [
          {
            paymentMethod: selectedPaymentMethod,
            amount: (cartState.basket?.total || 0) - pointsDiscount + (checkoutState.tipAmount || 0),
          },
        ],
        promoCode: cartState.basket?.promoCode || undefined,
        // Pass basket pre-calculated values to ensure consistency
        basketSubTotal: cartState.basket?.subTotal,
        basketTax: cartState.basket?.tax,
        basketDiscount: cartState.basket?.discount,
        basketCustomerDiscount: cartState.basket?.customerDiscount,
        basketTotal: (cartState.basket?.total || 0) - pointsDiscount + (checkoutState.tipAmount || 0),
        // Fidelity Points
        pointsToRedeem: redeemedPoints,
        // Tip
        tip: checkoutState.tipAmount || 0,
      };

      // Submit order
      const createdOrder = await createOrderFromBasket(orderCommand);

      // Funnel terminator — fired right after the backend confirms the
      // order. Lives inside the try-block so a backend 4xx/5xx doesn't
      // log a phantom completion. Re-instruments the legacy
      // /checkout/confirmation page-view that disappeared in C1.5.h
      // (see BUGS-IMPROVEMENTS-PLAN §C1.9 — analytics continuity).
      trackEvent('checkout_completed', {
        orderType: checkoutState.orderType ?? undefined,
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        loggedIn: isLoggedInForAnalytics(),
        source: 'review',
      });

      // Store order info for modal (capture email before clearing checkout state)
      setConfirmedOrder({
        id: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        customerEmail: checkoutState.customerInfo?.email || '',
      });

      // Clear cart and checkout state. Reset BOTH contexts: clearCheckout() wipes CheckoutContext
      // (customerInfo/tip/…) but OrderTypeContext persists its own copy, so without clearOrderType()
      // the next order has a chosen type (button enabled) yet empty customerInfo — Proceed then
      // silently no-ops. Resetting both makes the toggle require a fresh pick for the next order.
      await clearCart();
      clearCheckout();
      clearOrderType();

      // Send confirmation emails to both customer and admin (fire and forget)
      try {
        await sendOrderConfirmationEmails(createdOrder.id);
      } catch (emailError) {
        console.warn('Failed to send confirmation emails:', emailError);
        // Don't fail the order due to email issues
      }

      // Show success message
      enqueueSnackbar(t('order_placed_success', 'Order placed successfully!'), {
        variant: 'success',
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
      });

      // Modal will automatically show via useEffect watching confirmedOrder
    } catch (error) {
      console.error('Error placing order:', error);

      // Get translated error message
      const errorMessage = getTranslatedOrderError(error, t);

      setSubmitError(errorMessage);

      enqueueSnackbar(errorMessage, {
        variant: 'error',
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <OrderTypeSection
                orderType={checkoutState.orderType || 'Takeaway'}
                tableNumber={checkoutState.tableNumber}
                deliveryAddress={checkoutState.deliveryAddress || undefined}
                onEdit={handleEditOrder}
              />

              {/* Non-null: the prereq guard above redirects away when customerInfo is absent. */}
              <CustomerInfoSection customerInfo={checkoutState.customerInfo!} onEdit={handleEditOrder} />

              <OrderItemsList items={cartState.items} formatPrice={formatPrice} />

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
